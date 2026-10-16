/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Boot-time conversion of a `user` field with `allowMultiple: true` from the
 * one-account column an older binary stored it in to the list column it is now.
 *
 * ── What drifts ────────────────────────────────────────────────────────────
 * Older binaries accepted `allowMultiple: true` on a `user` field and still
 * stored ONE account: a text column keyed to the account table. The field now
 * stores a list of account ids — `text[]` on PostgreSQL, JSON text on SQLite —
 * with no foreign key, since no key can check a list. An install upgraded
 * WITHOUT touching its config keeps the old column: the config hash is
 * unchanged, so `initializeSchema` skips its migration steps (see
 * `user-foreign-key-reconciler.ts` for the same gap), and every list written
 * to it would be refused.
 *
 * On PostgreSQL the schema fast path already declines a list field whose live
 * column is not an array (`findOneAccountListColumns`), and the full migration
 * converts it — rebuilding a view-backed table's view around the change, which
 * an `ALTER` here could not do (the view reads every stored column). This step
 * is the fallback, and SQLite's only road. The drift is probed on the LIVE
 * column, on every boot, in the same startup phase as the foreign-key
 * reconciler:
 *
 *   - **PostgreSQL** — a column whose `data_type` is not `ARRAY` loses its
 *     foreign keys and becomes `text[]` in ONE `ALTER TABLE`, each stored id
 *     wrapped as a one-person list (`[id]`), an empty or absent one as NULL.
 *   - **SQLite** — a column still carrying a foreign key is rebuilt from the
 *     config (SQLite cannot drop a constraint), then every value that is not
 *     already a JSON list is wrapped the same way. Both run in one transaction.
 *
 * Idempotent: once converted, the probe finds a list column with nothing to
 * wrap and the step emits nothing. Like its neighbours it never fails the boot:
 * a conversion that cannot be applied is reported as a WARN naming the
 * consequence — the field refuses lists until it succeeds.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { isUserListField } from '@/domain/models/app/tables/user-list-field-service'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { db } from '@/infrastructure/database'
import { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import { logInfo, logWarning } from '@/infrastructure/logging/logger'
import { getBaseTableName, shouldUseView } from '../lookup/lookup-view-generators'
import { openSqliteDdlDatabase, runSqliteSchemaTransaction } from '../sql/dialect-ddl'
import { executeRaw } from '../sql/dialect-execute'
import { executeSQL, getExistingColumns } from '../sql/sql-execution'
import { recreateTableWithDataEffect } from '../table-operations/migration-utils'
import { buildGeneratorMaps } from './user-foreign-key-reconciler'
import type { TransactionLike } from '../sql/sql-execution'
import type { App, Table } from '@/domain/models/app'

/** One `user` list column of one app table. */
interface ListColumn {
  readonly table: Table
  /** The PHYSICAL relation — the `_base` table when the table is view-backed. */
  readonly relation: string
  readonly column: string
}

/** Tag a thrown value with the step that produced it. */
const asSchemaError = (operation: string) => (cause: unknown) =>
  new SchemaInitializationError({
    message: `Failed to ${operation} while converting user fields to lists`,
    cause,
  })

/** Every `user` field holding several people, with its physical relation. */
const collectListColumns = (app: Readonly<App>): readonly ListColumn[] =>
  (app.tables ?? []).flatMap((table) => {
    const sanitized = sanitizeTableName(table.name)
    const relation = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized
    return table.fields
      .filter((field) => isUserListField(field))
      .map((field) => ({ table, relation, column: field.name }))
  })

/** `"relation.column"`, for the boot log. */
const describe = (columns: readonly ListColumn[]): string =>
  columns.map((c) => `${c.relation}.${c.column}`).join(', ')

// ── PostgreSQL ─────────────────────────────────────────────────────────────

/** The list columns whose live column is not yet an array. */
const probePostgres = (
  columns: readonly ListColumn[]
): Effect.Effect<readonly ListColumn[], SchemaInitializationError> =>
  Effect.tryPromise({
    try: () =>
      executeRaw(
        db,
        sql`SELECT table_name, column_name, data_type FROM information_schema.columns
            WHERE table_schema = 'public'`
      ),
    catch: asSchemaError('read the column catalog'),
  }).pipe(
    Effect.map((rows) => {
      const types = new Map(
        rows.map((row) => [
          `${String(row['table_name'])}.${String(row['column_name'])}`,
          String(row['data_type']),
        ])
      )
      return columns.filter((c) => {
        const type = types.get(`${c.relation}.${c.column}`)
        return type !== undefined && type !== 'ARRAY'
      })
    })
  )

/**
 * Drop the column's foreign keys and turn it into `text[]` in ONE statement,
 * so the relation is never left half-converted. Keys are dropped by the name
 * the catalog holds, which survives a column rename.
 */
const convertPostgres = (c: ListColumn): Effect.Effect<void, SchemaInitializationError> =>
  Effect.gen(function* () {
    const keys = yield* Effect.tryPromise({
      try: () =>
        executeRaw(
          db,
          sql`SELECT con.conname AS name
              FROM pg_constraint con
              JOIN pg_class cl ON cl.oid = con.conrelid
              JOIN pg_namespace ns ON ns.oid = cl.relnamespace
              JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
              WHERE con.contype = 'f'
                AND ns.nspname = 'public'
                AND cl.relname = ${c.relation}
                AND att.attname = ${c.column}`
        ),
      catch: asSchemaError(`name the foreign keys on ${c.relation}.${c.column}`),
    })
    const drops = keys.map((row) => sql`DROP CONSTRAINT ${sql.identifier(String(row['name']))}, `)
    const column = sql.identifier(c.column)
    yield* Effect.tryPromise({
      try: () =>
        executeRaw(
          db,
          sql`ALTER TABLE ${sql.identifier(c.relation)} ${sql.join(drops, sql.raw(''))}ALTER COLUMN ${column} TYPE text[] USING CASE WHEN ${column} IS NULL OR ${column} = '' THEN NULL ELSE ARRAY[${column}] END`
        ),
      catch: asSchemaError(`convert ${c.relation}.${c.column} to a list`),
    })
    // The one-account column carried a btree index for its key; a list has none.
    const index = `idx_${sanitizeTableName(c.table.name)}_${c.column}_fk`
    yield* Effect.tryPromise({
      try: () => executeRaw(db, sql`DROP INDEX IF EXISTS ${sql.identifier(index)}`),
      catch: asSchemaError(`drop the key index of ${c.relation}.${c.column}`),
    })
  })

// ── SQLite ─────────────────────────────────────────────────────────────────

/** What one SQLite list column still needs: a rebuild (its key), a wrap (its values). */
interface SqliteDrift {
  readonly column: ListColumn
  readonly keyed: boolean
  readonly unwrapped: boolean
}

/** A value that is not already a JSON list — a bare id an older binary stored. */
const UNWRAPPED = (column: string): string =>
  `"${column}" IS NOT NULL AND (CASE WHEN json_valid("${column}") THEN json_type("${column}") END) IS NOT 'array'`

/** What each SQLite list column still needs; columns needing nothing are dropped. */
const probeSqlite = (
  columns: readonly ListColumn[]
): Effect.Effect<readonly SqliteDrift[], SchemaInitializationError> =>
  Effect.forEach(columns, (c) =>
    Effect.tryPromise({
      try: async () => {
        const present = await executeRaw(
          db,
          sql`SELECT 1 AS found FROM pragma_table_info(${c.relation}) WHERE name = ${c.column}`
        )
        if (present.length === 0) return []
        const keys = await executeRaw(
          db,
          sql`SELECT 1 AS found FROM pragma_foreign_key_list(${c.relation}) WHERE "from" = ${c.column}`
        )
        const bare = await executeRaw(
          db,
          // sql-literal: ddl -- the column is a config field name, quoted; nothing from a request
          sql`SELECT 1 AS found FROM ${sql.identifier(c.relation)} WHERE ${sql.raw(UNWRAPPED(c.column))} LIMIT 1`
        )
        const drift = { column: c, keyed: keys.length > 0, unwrapped: bare.length > 0 }
        return drift.keyed || drift.unwrapped ? [drift] : []
      },
      catch: asSchemaError(`read ${c.relation}.${c.column}`),
    })
  ).pipe(Effect.map((nested) => nested.flat()))

/** Rebuild a keyed table from the config (which no longer keys the list), then wrap. */
const convertSqliteColumn = (
  tx: TransactionLike,
  drift: SqliteDrift,
  maps: ReturnType<typeof buildGeneratorMaps>
) =>
  Effect.gen(function* () {
    const { relation, column, table } = drift.column
    if (drift.keyed) {
      const existingColumns = yield* getExistingColumns(tx, relation)
      yield* recreateTableWithDataEffect({ tx, table, existingColumns, ...maps })
    }
    // sql-literal: ddl -- relation and column are config identifiers, quoted
    yield* executeSQL(
      tx,
      `UPDATE "${relation}" SET "${column}" = CASE WHEN "${column}" = '' THEN NULL ELSE json_array("${column}") END WHERE ${UNWRAPPED(column)}`
    )
  })

/** Convert every drifted SQLite column in ONE transaction on a dedicated DDL connection. */
const convertSqlite = (
  drifted: readonly SqliteDrift[],
  path: string,
  maps: ReturnType<typeof buildGeneratorMaps>
): Effect.Effect<void, SchemaInitializationError> =>
  Effect.gen(function* () {
    const runtime = yield* Effect.context<never>()
    const client = openSqliteDdlDatabase(path)
    yield* Effect.tryPromise({
      try: () =>
        runSqliteSchemaTransaction(client, (tx) =>
          Effect.runPromiseWith(runtime)(
            Effect.forEach(drifted, (drift) => convertSqliteColumn(tx, drift, maps), {
              discard: true,
            })
          )
        ),
      catch: asSchemaError('convert the columns'),
    }).pipe(Effect.ensuring(Effect.sync(() => client.close())))
  })

// ── Step ───────────────────────────────────────────────────────────────────

/**
 * Post-schema startup step: turn every `user` field with `allowMultiple` still
 * stored as one account into a list column, keeping the stored account as a
 * one-person list. Never fails the boot (see the module docstring).
 */
export const reconcileUserListColumns = (app: Readonly<App>): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const columns = collectListColumns(app)
    if (columns.length === 0) return

    const config = parseDatabaseDialectConfig()
    const converted: readonly ListColumn[] =
      config.dialect === 'sqlite'
        ? yield* probeSqlite(columns).pipe(
            Effect.tap((drifted) =>
              drifted.length === 0
                ? Effect.void
                : convertSqlite(drifted, config.path, buildGeneratorMaps(app))
            ),
            Effect.map((drifted) => drifted.map((drift) => drift.column))
          )
        : yield* probePostgres(columns).pipe(
            Effect.tap((drifted) => Effect.forEach(drifted, convertPostgres, { discard: true }))
          )
    if (converted.length === 0) return

    yield* Effect.sync(() =>
      logInfo(
        `[schema] converted ${converted.length} user field(s) holding several people to lists ` +
          `(${describe(converted)}), keeping each stored account as a one-person list`,
        { relations: converted.map((c) => c.relation).join(',') }
      )
    )
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() =>
        logWarning(
          `[schema] could not convert the user field(s) holding several people ` +
            `(${describe(collectListColumns(app))}) to lists: ${error.message}. ` +
            `Until this succeeds, writing several people to them is refused.`
        )
      )
    ),
    Effect.withSpan('schema.reconcile-user-list-columns')
  )
