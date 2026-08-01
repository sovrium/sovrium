/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  TIMESTAMPTZ_MIGRATION_ENV_VAR,
  TIMESTAMPTZ_MIGRATION_ACK_NON_UTC_ENV_VAR,
  parseTimestamptzMigrationEnvConfig,
  isTimestamptzMigrationEnabled,
  isNonUtcConversionAcknowledged,
  isUtcTimeZoneName,
} from '@/domain/models/env/database/timestamptz-migration'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { db } from '@/infrastructure/database'
import { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import { logInfo, logWarning } from '@/infrastructure/logging/logger'
import { getBaseTableName, shouldUseView } from './lookup/lookup-view-generators'
import { executeRaw } from './sql/dialect-execute'
import { isSqliteRuntime } from './unsupported-in-sqlite'
import type { App, Table } from '@/domain/models/app'

const DECLARED_TIMESTAMP_FIELD_TYPES: ReadonlySet<string> = new Set([
  'created-at',
  'updated-at',
  'deleted-at',
])

const NAIVE_DATA_TYPE = 'timestamp without time zone'
const TARGET_DATA_TYPE = 'timestamptz'

export interface TimestamptzCandidate {
  readonly relation: string
  readonly column: string
}

const collectTableCandidates = (table: Readonly<Table>): readonly TimestamptzCandidate[] => {
  const sanitized = sanitizeTableName(table.name)
  const relation = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized
  return table.fields
    .filter((field) => DECLARED_TIMESTAMP_FIELD_TYPES.has(field.type))
    .map((field) => ({ relation, column: field.name }))
}

export const collectTimestamptzCandidates = (app: Readonly<App>): readonly TimestamptzCandidate[] =>
  (app.tables ?? []).flatMap((table) => collectTableCandidates(table))

const asSchemaError = (operation: string) => (cause: unknown) =>
  new SchemaInitializationError({
    message: `Failed to ${operation} while reconciling timestamp columns`,
    cause,
  })

const probeDriftedColumns = (
  candidates: readonly TimestamptzCandidate[]
): Effect.Effect<readonly TimestamptzCandidate[], SchemaInitializationError> =>
  Effect.tryPromise({
    try: () =>
      executeRaw(
        db,
        sql`SELECT c.table_name AS relation, c.column_name AS column_name
            FROM information_schema.columns c
            JOIN information_schema.tables t
              ON t.table_schema = c.table_schema AND t.table_name = c.table_name
            WHERE c.table_schema = 'public'
              AND t.table_type = 'BASE TABLE'
              AND c.data_type = ${NAIVE_DATA_TYPE}`
      ),
    catch: asSchemaError('read the column catalog'),
  }).pipe(
    Effect.map((rows) => {
      const naive = new Set(
        rows.map((row) => `${String(row['relation'])}.${String(row['column_name'])}`)
      )
      return candidates.filter((candidate) =>
        naive.has(`${candidate.relation}.${candidate.column}`)
      )
    })
  )

const warnAboutDrift = (drifted: readonly TimestamptzCandidate[]): Effect.Effect<void, never> =>
  Effect.forEach(
    drifted,
    (candidate) =>
      Effect.sync(() =>
        logWarning(
          `[schema] ${candidate.relation}.${candidate.column} is ${NAIVE_DATA_TYPE}; ` +
            `the target type is ${TARGET_DATA_TYPE}. No DDL was emitted — set ` +
            `${TIMESTAMPTZ_MIGRATION_ENV_VAR}=on to convert it (a full table rewrite ` +
            `under an ACCESS EXCLUSIVE lock, so schedule a maintenance window).`,
          { relation: candidate.relation, column: candidate.column }
        )
      ),
    { discard: true }
  )

const preflightSessionTimeZone = (): Effect.Effect<void, SchemaInitializationError> =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () => executeRaw(db, sql`SELECT current_setting('TimeZone') AS time_zone`),
      catch: asSchemaError('read the session TimeZone'),
    })
    const timeZone = String(rows[0]?.['time_zone'] ?? '')
    if (isUtcTimeZoneName(timeZone)) return
    if (isNonUtcConversionAcknowledged(parseTimestamptzMigrationEnvConfig())) return

    return yield* new SchemaInitializationError({
      message:
        `Refusing to convert timestamp columns to ${TARGET_DATA_TYPE}: the database session ` +
        `TimeZone is '${timeZone}', not UTC. The stored naive values are wall-clock time in ` +
        `that zone, so the conversion preserves every instant only if the server's TimeZone ` +
        `has been constant for the whole life of the data — and rows written during a DST ` +
        `fall-back hour may still convert one hour off. Neither is observable from the ` +
        `column. Set ${TIMESTAMPTZ_MIGRATION_ACK_NON_UTC_ENV_VAR}=1 to acknowledge both and ` +
        `proceed, pin the server to UTC first, or unset ${TIMESTAMPTZ_MIGRATION_ENV_VAR} to ` +
        `leave the columns unchanged.`,
    })
  })

const convertDriftedColumns = (
  drifted: readonly TimestamptzCandidate[]
): Effect.Effect<void, SchemaInitializationError> =>
  Effect.forEach(
    drifted,
    (candidate) =>
      Effect.tryPromise({
        try: () =>
          executeRaw(
            db,
            sql`ALTER TABLE ${sql.identifier(candidate.relation)}
                ALTER COLUMN ${sql.identifier(candidate.column)} TYPE TIMESTAMPTZ`
          ),
        catch: asSchemaError(`convert ${candidate.relation}.${candidate.column}`),
      }),
    { discard: true }
  ).pipe(
    Effect.tap(() =>
      Effect.sync(() =>
        logInfo(`[schema] converted ${drifted.length} timestamp column(s) to ${TARGET_DATA_TYPE}`)
      )
    )
  )

export const reconcileTimestamptzColumns = (
  app: Readonly<App>
): Effect.Effect<void, SchemaInitializationError> =>
  Effect.gen(function* () {
    if (isSqliteRuntime()) return

    const candidates = collectTimestamptzCandidates(app)
    if (candidates.length === 0) return

    const drifted = yield* probeDriftedColumns(candidates)
    if (drifted.length === 0) return

    if (!isTimestamptzMigrationEnabled(parseTimestamptzMigrationEnvConfig())) {
      return yield* warnAboutDrift(drifted)
    }

    yield* preflightSessionTimeZone()
    yield* convertDriftedColumns(drifted)
  })
