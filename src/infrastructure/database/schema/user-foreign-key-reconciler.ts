/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { Effect, Runtime } from 'effect'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { db } from '@/infrastructure/database'
import { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import { logInfo, logWarning } from '@/infrastructure/logging/logger'
import { getBaseTableName, shouldUseView } from '../lookup/lookup-view-generators'
import { openSqliteDdlDatabase, runSqliteSchemaTransaction } from '../sql/dialect-ddl'
import { executeRaw } from '../sql/dialect-execute'
import { getExistingColumns } from '../sql/sql-execution'
import { isUserField } from '../sql/sql-field-predicates'
import { generateForeignKeyConstraints } from '../sql/sql-key-constraints'
import { recreateTableWithDataEffect } from '../table-operations/migration-utils'
import type { SQLExecutionError, TransactionLike } from '../sql/sql-execution'
import type { App, Table } from '@/domain/models/app'

const asSchemaError = (operation: string) => (cause: unknown) =>
  new SchemaInitializationError({
    message: `Failed to ${operation} while reconciling user foreign keys`,
    cause,
  })

const PG_SET_NULL = 'n'

const SQLITE_SET_NULL = 'SET NULL'

export interface UserForeignKeyCandidate {
  readonly table: Table
  readonly relation: string
  readonly column: string
}

const collectTableCandidates = (table: Readonly<Table>): readonly UserForeignKeyCandidate[] => {
  const sanitized = sanitizeTableName(table.name)
  const relation = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized
  return table.fields.filter(isUserField).map((field) => ({ table, relation, column: field.name }))
}

export const collectUserForeignKeyCandidates = (
  app: Readonly<App>
): readonly UserForeignKeyCandidate[] =>
  (app.tables ?? []).flatMap((table) => collectTableCandidates(table))

const buildTableUsesView = (app: Readonly<App>): ReadonlyMap<string, boolean> =>
  new Map((app.tables ?? []).map((table) => [table.name, shouldUseView(table)]))

const probePostgresDrift = (
  candidates: readonly UserForeignKeyCandidate[]
): Effect.Effect<readonly UserForeignKeyCandidate[], SchemaInitializationError> =>
  Effect.tryPromise({
    try: () =>
      executeRaw(
        db,
        sql`SELECT cl.relname AS relation, att.attname AS column_name, con.confdeltype AS on_delete
          FROM pg_constraint con
          JOIN pg_class cl ON cl.oid = con.conrelid
          JOIN pg_namespace ns ON ns.oid = cl.relnamespace
          JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
          WHERE con.contype = 'f'
            AND ns.nspname = 'public'
            AND array_length(con.conkey, 1) = 1`
      ),
    catch: asSchemaError('read the foreign-key catalog'),
  }).pipe(
    Effect.map((rows) => {
      const actions = new Map(
        rows.map((row) => [
          `${String(row['relation'])}.${String(row['column_name'])}`,
          String(row['on_delete']),
        ])
      )
      return candidates.filter((candidate) => {
        const action = actions.get(`${candidate.relation}.${candidate.column}`)
        return action !== undefined && action !== PG_SET_NULL
      })
    })
  )

const probeSqliteDrift = (
  candidates: readonly UserForeignKeyCandidate[]
): Effect.Effect<readonly UserForeignKeyCandidate[], SchemaInitializationError> =>
  Effect.forEach(candidates, (candidate) =>
    Effect.tryPromise({
      try: () =>
        executeRaw(
          db,
          sql`SELECT on_delete FROM pragma_foreign_key_list(${candidate.relation})
              WHERE "from" = ${candidate.column}`
        ),
      catch: asSchemaError(`read the foreign keys of ${candidate.relation}`),
    }).pipe(
      Effect.map((rows) => {
        const action = rows[0]?.['on_delete']
        return action !== undefined && String(action) !== SQLITE_SET_NULL ? [candidate] : []
      })
    )
  ).pipe(Effect.map((nested) => nested.flat()))

const correctedConstraint = (candidate: Readonly<UserForeignKeyCandidate>): string | undefined =>
  generateForeignKeyConstraints(
    candidate.table.name,
    candidate.table.fields.filter((field) => isUserField(field) && field.name === candidate.column)
  )[0]

const repairPostgresKey = (
  candidate: Readonly<UserForeignKeyCandidate>
): Effect.Effect<void, SchemaInitializationError> =>
  Effect.gen(function* () {
    const constraint = correctedConstraint(candidate)
    if (constraint === undefined) return

    const existing = yield* Effect.tryPromise({
      try: () =>
        executeRaw(
          db,
          sql`SELECT con.conname AS name
              FROM pg_constraint con
              JOIN pg_class cl ON cl.oid = con.conrelid
              JOIN pg_namespace ns ON ns.oid = cl.relnamespace
              JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
              WHERE con.contype = 'f'
                AND ns.nspname = 'public'
                AND cl.relname = ${candidate.relation}
                AND att.attname = ${candidate.column}`
        ),
      catch: asSchemaError(`name the foreign keys on ${candidate.relation}.${candidate.column}`),
    })
    const drops = existing.map((row) => sql`DROP CONSTRAINT ${sql.identifier(String(row['name']))}`)
    if (drops.length === 0) return

    yield* Effect.tryPromise({
      try: () =>
        executeRaw(
          db,
          sql`ALTER TABLE ${sql.identifier(candidate.relation)} ${sql.join(drops, sql.raw(', '))}, ADD ${sql.raw(constraint)} NOT VALID`
        ),
      catch: asSchemaError(`replace the foreign key on ${candidate.relation}.${candidate.column}`),
    })
  })

const repairSqliteTable = (
  tx: TransactionLike,
  candidate: Readonly<UserForeignKeyCandidate>,
  tableUsesView: ReadonlyMap<string, boolean>
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const existingColumns = yield* getExistingColumns(tx, candidate.table.name)
    yield* recreateTableWithDataEffect(tx, candidate.table, existingColumns, tableUsesView)
  })

const repairSqlite = (
  drifted: readonly UserForeignKeyCandidate[],
  path: string,
  tableUsesView: ReadonlyMap<string, boolean>
): Effect.Effect<void, SchemaInitializationError> =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<never>()
    const client = openSqliteDdlDatabase(path)
    yield* Effect.tryPromise({
      try: () =>
        runSqliteSchemaTransaction(client, (tx) =>
          Runtime.runPromise(runtime)(
            Effect.forEach(
              drifted,
              (candidate) => repairSqliteTable(tx, candidate, tableUsesView),
              {
                discard: true,
              }
            )
          )
        ),
      catch: asSchemaError('rebuild the tables whose keys drifted'),
    }).pipe(Effect.ensuring(Effect.sync(() => client.close())))
  })

const warnReconcileFailed = (
  affected: readonly UserForeignKeyCandidate[],
  error: Readonly<SchemaInitializationError>
): Effect.Effect<void, never> =>
  Effect.sync(() =>
    logWarning(
      `[schema] could not put ON DELETE SET NULL on the user foreign key(s) ` +
        `${affected.map((c) => `${c.relation}.${c.column}`).join(', ')}: ${error.message}. ` +
        `Until this succeeds, erasing an account that is assigned on a record written by ` +
        `somebody else fails and the account cannot be deleted at all.`,
      { relations: affected.map((candidate) => candidate.relation).join(',') }
    )
  )

const logReconciled = (drifted: readonly UserForeignKeyCandidate[]): Effect.Effect<void, never> =>
  Effect.sync(() =>
    logInfo(
      `[schema] put ON DELETE SET NULL on ${drifted.length} user foreign key(s) ` +
        `(${drifted.map((c) => `${c.relation}.${c.column}`).join(', ')}) so an assigned ` +
        `account stays erasable`,
      { relations: drifted.map((candidate) => candidate.relation).join(',') }
    )
  )

export const reconcileUserForeignKeys = (app: Readonly<App>): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const candidates = collectUserForeignKeyCandidates(app)
    if (candidates.length === 0) return

    const config = parseDatabaseDialectConfig()
    const drifted = yield* (config.dialect === 'sqlite' ? probeSqliteDrift : probePostgresDrift)(
      candidates
    )
    if (drifted.length === 0) return

    yield* config.dialect === 'sqlite'
      ? repairSqlite(drifted, config.path, buildTableUsesView(app))
      : Effect.forEach(drifted, repairPostgresKey, { discard: true })

    yield* logReconciled(drifted)
  }).pipe(
    Effect.catchAll((error) => warnReconcileFailed(collectUserForeignKeyCandidates(app), error))
  )
