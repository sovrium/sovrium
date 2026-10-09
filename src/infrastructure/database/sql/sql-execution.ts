/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

/**
 * Type definition for a database transaction that can execute raw SQL.
 *
 * `params` binds `$1`, `$2`, … positionally — `bun:sql` on PostgreSQL and the
 * `bun:sqlite` adapter (`sqliteTransactionLike`) both honour it. A wrapper that
 * re-exposes another transaction's `unsafe` must FORWARD `params`: the type
 * cannot catch a wrapper that drops them, because a one-argument function is
 * assignable here, and a dropped array fails only at run time with an unbound
 * placeholder.
 */
export interface TransactionLike {
  readonly unsafe: (sql: string, params?: readonly unknown[]) => Promise<readonly unknown[]>
}

/**
 * Wrap a `bun:sql` client or transaction as a {@link TransactionLike}, bound
 * values included. Every PostgreSQL wrapper goes through this so none can drop
 * `params` — a hand-written `(sql) => client.unsafe(sql)` type-checks and then
 * fails at run time on the first `$1`.
 */
export const postgresTransactionLike = (client: {
  readonly unsafe: (sql: string, values?: unknown[]) => PromiseLike<unknown>
}): TransactionLike => ({
  unsafe: async (sql, params) =>
    (await client.unsafe(
      sql,
      params === undefined ? undefined : [...params]
    )) as readonly unknown[],
})

/**
 * Error type for SQL execution failures
 */
export class SQLExecutionError extends Data.TaggedError('SQLExecutionError')<{
  readonly message: string
  readonly sql?: string
  readonly cause?: unknown
}> {}

/**
 * Type definition for information_schema.columns row
 */
export interface ColumnInfo {
  readonly column_name: string
  readonly data_type: string
  readonly is_nullable: string
  readonly column_default: string | null
}

/**
 * Type definition for table existence query result
 */
interface TableExistsResult {
  readonly exists: boolean
}

/**
 * Type definition for table name query result
 */
interface TableNameResult {
  readonly tablename: string
}

/**
 * Type definition for view name query result
 */
interface ViewNameResult {
  readonly viewname: string
}

/**
 * Type definition for materialized view name query result
 */
interface MatViewNameResult {
  readonly matviewname: string
}

// ============================================================================
// SQL Statement Execution Helpers
// ============================================================================

/**
 * Execute a single SQL statement within an Effect context
 *
 * SECURITY NOTE: This function uses tx.unsafe() which is intentional for DDL execution.
 * See schema-initializer.ts for detailed security rationale.
 */
export const executeSQL = (
  tx: TransactionLike,
  sql: string,
  params?: readonly unknown[]
): Effect.Effect<readonly unknown[], SQLExecutionError> =>
  Effect.tryPromise({
    try: () => (params === undefined ? tx.unsafe(sql) : tx.unsafe(sql, params)),
    catch: (error) =>
      new SQLExecutionError({
        message: `SQL execution failed: ${String(error)}`,
        sql,
        cause: error,
      }),
  })

/**
 * Execute multiple SQL statements sequentially
 * Use this when statements must be executed in order (e.g., DDL that depends on previous statements)
 */
export const executeSQLStatements = (
  tx: TransactionLike,
  statements: readonly string[]
): Effect.Effect<void, SQLExecutionError> =>
  statements.length === 0
    ? Effect.void
    : Effect.gen(function* () {
        for (const sql of statements) {
          yield* executeSQL(tx, sql)
        }
      })

/**
 * Execute multiple SQL statements in parallel
 * Use this when statements are independent (e.g., DROP VIEW statements, index creation)
 *
 * Note: PostgreSQL allows concurrent DDL operations within a transaction,
 * but some operations may still serialize at the database level.
 */
export const executeSQLStatementsParallel = (
  tx: TransactionLike,
  statements: readonly string[]
): Effect.Effect<void, SQLExecutionError> =>
  statements.length === 0
    ? Effect.void
    : // eslint-disable-next-line sovrium/no-unbounded-promise-fanout -- all statements execute on the single reserved transaction connection: width cannot exceed one pooled connection regardless of fan-out.
      Effect.forEach(statements, (sql) => executeSQL(tx, sql), { concurrency: 'unbounded' }).pipe(
        Effect.asVoid
      )

// ============================================================================
// Information Schema Query Helpers
// ============================================================================

/**
 * Check if a table exists in the database
 *
 * SECURITY NOTE: String interpolation is used for tableName.
 * This is SAFE because:
 * 1. tableName comes from validated Effect Schema (Table.name field)
 * 2. Table names are defined in schema configuration, not user input
 * 3. The App schema is validated before reaching this code
 * 4. information_schema queries are read-only (no data modification risk)
 */
export const tableExists = (
  tx: TransactionLike,
  tableName: string
): Effect.Effect<boolean, SQLExecutionError> =>
  isSqliteRuntime()
    ? // SQLite — sqlite_master catalogs every table; COUNT(*) > 0 mirrors EXISTS.
      executeSQL(
        tx,
        `
        SELECT EXISTS (
          SELECT 1
          FROM sqlite_master
          WHERE type = 'table'
            AND name = '${tableName}'
        ) as "exists"
      `
      ).pipe(Effect.map((result) => Boolean((result as readonly TableExistsResult[])[0]?.exists)))
    : executeSQL(
        tx,
        `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_name = '${tableName}'
        AND table_schema = 'public'
    ) as exists
  `
      ).pipe(Effect.map((result) => (result as readonly TableExistsResult[])[0]?.exists ?? false))

/** Shape of one entry in the column map returned by `getExistingColumns`. */
type ExistingColumnEntry = {
  dataType: string
  isNullable: string
  columnDefault: string | null
}

/**
 * SQLite arm of `getExistingColumns` — `pragma_table_xinfo` reports per-column
 * name/type/notnull/default. `is_nullable` is normalized to the Postgres-shaped
 * `'YES'`/`'NO'` string so downstream consumers (migration helpers) need no
 * per-dialect branch.
 *
 * `xinfo`, not `table_info`: `pragma_table_info` omits GENERATED columns, so a
 * formula column read as missing and every later migration of its table tried
 * to `ADD COLUMN` it again (`duplicate column name`). `hidden` is 2 (virtual)
 * or 3 (stored) for a generated column and 1 only for a virtual table's hidden
 * column, which is not a column of the table's own. PostgreSQL's
 * `information_schema.columns` already lists generated columns, so the two
 * arms now agree.
 */
const getExistingColumnsSqlite = (
  tx: TransactionLike,
  tableName: string
): Effect.Effect<ReadonlyMap<string, ExistingColumnEntry>, SQLExecutionError> =>
  executeSQL(
    tx,
    `SELECT name AS column_name, type AS data_type, "notnull", dflt_value
     FROM pragma_table_xinfo('${tableName}')
     WHERE hidden <> 1`
  ).pipe(
    Effect.map((result) => {
      const rows = result as readonly {
        column_name: string
        data_type: string
        notnull: number
        dflt_value: string | null
      }[]
      return new Map(
        rows.map((row) => [
          row.column_name,
          {
            dataType: row.data_type,
            isNullable: row.notnull === 0 ? 'YES' : 'NO',
            columnDefault: row.dflt_value,
          },
        ])
      )
    })
  )

/** PostgreSQL arm of `getExistingColumns` — queries `information_schema`. */
const getExistingColumnsPostgres = (
  tx: TransactionLike,
  tableName: string
): Effect.Effect<ReadonlyMap<string, ExistingColumnEntry>, SQLExecutionError> =>
  executeSQL(
    tx,
    `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = '${tableName}'
      AND table_schema = 'public'
  `
  ).pipe(
    Effect.map((result) => {
      const rows = result as readonly ColumnInfo[]
      return new Map(
        rows.map((row) => [
          row.column_name,
          {
            dataType: row.data_type,
            isNullable: row.is_nullable,
            columnDefault: row.column_default,
          },
        ])
      )
    })
  )

/**
 * Get existing columns from a table
 *
 * SECURITY NOTE: String interpolation is used for tableName.
 * This is SAFE because tableName comes from validated schema configuration.
 */
export const getExistingColumns = (
  tx: TransactionLike,
  tableName: string
): Effect.Effect<ReadonlyMap<string, ExistingColumnEntry>, SQLExecutionError> =>
  isSqliteRuntime()
    ? getExistingColumnsSqlite(tx, tableName)
    : getExistingColumnsPostgres(tx, tableName)

/**
 * Get all existing table names in the public schema
 *
 * SECURITY NOTE: This query is read-only and uses pg_tables system catalog.
 * No user input is involved.
 */
export const getExistingTableNames = (
  tx: TransactionLike
): Effect.Effect<readonly string[], SQLExecutionError> =>
  isSqliteRuntime()
    ? // SQLite — sqlite_master lists tables; exclude the internal sqlite_*
      // bookkeeping tables (sqlite_sequence etc.) to match pg_tables' scope.
      executeSQL(
        tx,
        `
        SELECT name AS tablename
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
      `
      ).pipe(
        Effect.map((result) => (result as readonly TableNameResult[]).map((row) => row.tablename))
      )
    : executeSQL(
        tx,
        `
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `
      ).pipe(
        Effect.map((result) => (result as readonly TableNameResult[]).map((row) => row.tablename))
      )

/**
 * The SQLite virtual tables (FTS5 indexes, in practice) — `[]` on PostgreSQL.
 *
 * A virtual table owns shadow tables that `sqlite_master` lists as ordinary
 * tables, and SQLite refuses to drop one of those on its own ("may not be
 * dropped"): only dropping the virtual table removes them. A caller that drops a
 * list of tables needs this set to drop the virtual ones first and skip their
 * shadows — the catalog order cannot be trusted for that, since `VACUUM INTO`
 * (every restored backup) lists the shadows BEFORE their virtual table.
 */
export const getSqliteVirtualTableNames = (
  tx: TransactionLike
): Effect.Effect<readonly string[], SQLExecutionError> =>
  isSqliteRuntime()
    ? executeSQL(
        tx,
        `SELECT name AS tablename FROM sqlite_master
         WHERE type = 'table' AND sql LIKE 'CREATE VIRTUAL TABLE%'`
      ).pipe(
        Effect.map((result) => (result as readonly TableNameResult[]).map((row) => row.tablename))
      )
    : Effect.succeed([])

/**
 * Get all existing view names in the public schema
 *
 * SECURITY NOTE: This query is read-only and uses pg_views system catalog.
 * No user input is involved.
 */
export const getExistingViews = (
  tx: TransactionLike
): Effect.Effect<readonly string[], SQLExecutionError> =>
  isSqliteRuntime()
    ? // SQLite — views live in sqlite_master alongside tables, keyed by type.
      executeSQL(
        tx,
        `
        SELECT name AS viewname
        FROM sqlite_master
        WHERE type = 'view'
      `
      ).pipe(
        Effect.map((result) => (result as readonly ViewNameResult[]).map((row) => row.viewname))
      )
    : executeSQL(
        tx,
        `
    SELECT viewname
    FROM pg_views
    WHERE schemaname = 'public'
  `
      ).pipe(
        Effect.map((result) => (result as readonly ViewNameResult[]).map((row) => row.viewname))
      )

/**
 * Get all existing materialized view names in the public schema
 *
 * SECURITY NOTE: This query is read-only and uses pg_matviews system catalog.
 * No user input is involved.
 */
export const getExistingMaterializedViews = (
  tx: TransactionLike
): Effect.Effect<readonly string[], SQLExecutionError> =>
  isSqliteRuntime()
    ? // SQLite has no materialized views — always report none. Materialized
      // views are a Postgres-only feature that degrades in Phase 6.
      Effect.succeed([])
    : executeSQL(
        tx,
        `
    SELECT matviewname
    FROM pg_matviews
    WHERE schemaname = 'public'
  `
      ).pipe(
        Effect.map((result) =>
          (result as readonly MatViewNameResult[]).map((row) => row.matviewname)
        )
      )
