/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Boot-time reconciliation of declared timestamp columns onto `TIMESTAMPTZ`.
 *
 * ── What drifts ───────────────────────────────────────────────────────────
 * `created_at` / `updated_at` / `deleted_at` are emitted from three places: the
 * intrinsic column generator, the ALTER-TABLE backfill, and the declared-field
 * type map. The first two have always emitted `TIMESTAMPTZ`; the third emitted
 * `TIMESTAMP` without zone, so writing the field out explicitly — arguably the
 * more deliberate act — produced the worse type. New columns are unified now,
 * but every column an existing deployment already created is still naive.
 *
 * ── Why this is NOT part of the ordinary migration path ───────────────────
 * TWO independent reasons, and each alone would be sufficient.
 *
 * 1. It must not fire automatically. `ALTER TABLE … ALTER COLUMN … TYPE
 *    TIMESTAMPTZ` is not metadata-only: PostgreSQL rewrites the entire table and
 *    holds an `ACCESS EXCLUSIVE` lock throughout. Emitted from the migration
 *    path it would run on every running deployment's next deploy, as a side
 *    effect of any unrelated config edit — a boot-time outage taken while the
 *    operator is watching a deploy rather than a maintenance window, and
 *    completely invisible on a fresh install.
 * 2. THE TRAP the migration path cannot escape: it sits behind a checksum fast
 *    path whose only input is `app.tables`. An operator who upgrades the binary
 *    WITHOUT editing their config matches the checksum and never reaches it —
 *    which is precisely the install carrying the drifted columns. The drift is a
 *    property of the LIVE column, not of the config, so it must be probed
 *    unconditionally on every boot. (Same reasoning, same placement, as the
 *    attachment-URL repair that shares this startup phase.)
 *
 * ── Why the conversion carries no `USING` clause ──────────────────────────
 * PostgreSQL's default `timestamp → timestamptz` cast interprets the naive value
 * in the session `TimeZone` — the exact inverse of the write that produced it,
 * since `CURRENT_TIMESTAMP` is a `timestamptz` implicitly cast DOWN through that
 * same GUC. The instant is therefore preserved on ANY server whose `TimeZone`
 * has been constant for the life of the data, UTC or not.
 *
 * `USING <col> AT TIME ZONE 'UTC'` is strictly dominated and is never used: it
 * ASSERTS the naive values were UTC, which is a no-op on a UTC server and shifts
 * every row by the server's offset on any other.
 *
 * ── Why a non-UTC server needs a second acknowledgement ───────────────────
 * On a non-UTC server two violations of the constancy assumption become
 * reachable, and neither is observable from the column: a mid-life `TimeZone`
 * change (rows on either side are wall-clock in different zones, and which zone
 * applied to which row was discarded by the write-time cast), and DST fall-back
 * ambiguity (a repeated local hour maps to two instants; PostgreSQL picks one).
 * The preflight aborts boot rather than silently converting.
 *
 * ── SQLite ────────────────────────────────────────────────────────────────
 * Nothing to do and nothing at risk: every timestamp type maps to `TEXT`, the
 * `SQLITE_ISO_NOW` write is UTC-by-construction with an explicit `Z`, and SQLite
 * has no `ALTER COLUMN` at all. This module self-skips.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  TIMESTAMPTZ_MIGRATION_ENV_VAR,
  TIMESTAMPTZ_MIGRATION_ACK_NON_UTC_ENV_VAR,
  parseTimestamptzMigrationEnvConfig,
  isTimestamptzMigrationEnabled,
  isNonUtcConversionAcknowledged,
  isUtcTimeZoneName,
} from '@/domain/models/process-env/database/timestamptz-migration'
import { db } from '@/infrastructure/database'
import { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import { logInfo, logWarning } from '@/infrastructure/logging/logger'
import { getBaseTableName, shouldUseView } from './lookup/lookup-view-generators'
import { executeRaw } from './sql/dialect-execute'
import { isSqliteRuntime } from './unsupported-in-sqlite'
import type { App, Table } from '@/domain/models/app'

/** Field types whose column records an instant and therefore wants a zone. */
const DECLARED_TIMESTAMP_FIELD_TYPES: ReadonlySet<string> = new Set([
  'created-at',
  'updated-at',
  'deleted-at',
])

/** How `information_schema` spells the zone-naive type, and the target. */
const NAIVE_DATA_TYPE = 'timestamp without time zone'
const TARGET_DATA_TYPE = 'timestamptz'

/** One declared timestamp column of one physical relation. */
export interface TimestamptzCandidate {
  /** The PHYSICAL relation — the `_base` table when the table is view-backed. */
  readonly relation: string
  /** `field.name` IS the column name; there is no mapper. */
  readonly column: string
}

const collectTableCandidates = (table: Readonly<Table>): readonly TimestamptzCandidate[] => {
  const sanitized = sanitizeTableName(table.name)
  const relation = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized
  return table.fields
    .filter((field) => DECLARED_TIMESTAMP_FIELD_TYPES.has(field.type))
    .map((field) => ({ relation, column: field.name }))
}

/**
 * Every DECLARED `created-at` / `updated-at` / `deleted-at` column in the app.
 *
 * Intrinsic timestamp columns are deliberately out of scope: they are absent
 * from `table.fields` by definition, and they have always been `TIMESTAMPTZ`.
 */
export const collectTimestamptzCandidates = (app: Readonly<App>): readonly TimestamptzCandidate[] =>
  (app.tables ?? []).flatMap((table) => collectTableCandidates(table))

const asSchemaError = (operation: string) => (cause: unknown) =>
  new SchemaInitializationError({
    message: `Failed to ${operation} while reconciling timestamp columns`,
    cause,
  })

/**
 * Which of `candidates` are still zone-naive in the live catalog.
 *
 * Reads every naive timestamp column of every public BASE TABLE in one query and
 * intersects in TypeScript. Restricting to base tables excludes generated views,
 * whose columns mirror the base table's type but cannot be ALTERed.
 */
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

/**
 * Log one actionable WARN per drifted column and emit no DDL.
 *
 * The table, column, current type, target type and opt-in variable all ride the
 * MESSAGE rather than the structured attributes, deliberately: attributes travel
 * only on the exported OTLP record, and an operator reading a boot log on a
 * self-hosted box must be able to act without a telemetry backend.
 */
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

/**
 * Refuse to convert on a server whose `TimeZone` is not UTC unless the operator
 * has acknowledged the two unobservable violation modes.
 *
 * The reading comes from `current_setting('TimeZone')` on the SAME pool that
 * will run the ALTER, so it reports the zone that will actually govern the cast.
 */
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

/**
 * Convert each drifted column with the DEFAULT cast — no `USING` clause. The
 * absence is the whole point; see the module docstring before adding one.
 */
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

/**
 * Post-schema startup step: unify declared timestamp columns on `TIMESTAMPTZ`,
 * behind the operator gate.
 *
 * Fails the boot ONLY when the operator opted in and the preflight refuses —
 * that abort is the point. With the gate off this step never emits DDL, so every
 * existing deployment boots exactly as it did before.
 */
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
