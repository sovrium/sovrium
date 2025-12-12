/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'

/**
 * Type definition for a database transaction that can execute raw SQL
 */
export interface TransactionLike {
  readonly unsafe: (sql: string) => Promise<readonly unknown[]>
}

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
  sql: string
): Effect.Effect<readonly unknown[], SQLExecutionError> =>
  Effect.tryPromise({
    try: () => tx.unsafe(sql),
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
/* eslint-disable functional/no-loop-statements */
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
/* eslint-enable functional/no-loop-statements */

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
    : Effect.all(
        statements.map((sql) => executeSQL(tx, sql)),
        { concurrency: 'unbounded' }
      ).pipe(Effect.asVoid)

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
  executeSQL(
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

/**
 * Get existing columns from a table
 *
 * SECURITY NOTE: String interpolation is used for tableName.
 * This is SAFE because tableName comes from validated schema configuration.
 */
export const getExistingColumns = (
  tx: TransactionLike,
  tableName: string
): Effect.Effect<
  ReadonlyMap<string, { dataType: string; isNullable: string }>,
  SQLExecutionError
> =>
  executeSQL(
    tx,
    `
    SELECT column_name, data_type, is_nullable
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
          },
        ])
      )
    })
  )

/**
 * Get all existing table names in the public schema
 *
 * SECURITY NOTE: This query is read-only and uses pg_tables system catalog.
 * No user input is involved.
 */
export const getExistingTableNames = (
  tx: TransactionLike
): Effect.Effect<readonly string[], SQLExecutionError> =>
  executeSQL(
    tx,
    `
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `
  ).pipe(Effect.map((result) => (result as readonly TableNameResult[]).map((row) => row.tablename)))

/**
 * Get all existing view names in the public schema
 *
 * SECURITY NOTE: This query is read-only and uses pg_views system catalog.
 * No user input is involved.
 */
export const getExistingViews = (
  tx: TransactionLike
): Effect.Effect<readonly string[], SQLExecutionError> =>
  executeSQL(
    tx,
    `
    SELECT viewname
    FROM pg_views
    WHERE schemaname = 'public'
  `
  ).pipe(Effect.map((result) => (result as readonly ViewNameResult[]).map((row) => row.viewname)))

/**
 * Get all existing materialized view names in the public schema
 *
 * SECURITY NOTE: This query is read-only and uses pg_matviews system catalog.
 * No user input is involved.
 */
export const getExistingMaterializedViews = (
  tx: TransactionLike
): Effect.Effect<readonly string[], SQLExecutionError> =>
  executeSQL(
    tx,
    `
    SELECT matviewname
    FROM pg_matviews
    WHERE schemaname = 'public'
  `
  ).pipe(
    Effect.map((result) => (result as readonly MatViewNameResult[]).map((row) => row.matviewname))
  )

// ============================================================================
// Async Wrappers for Backward Compatibility
// ============================================================================

/**
 * Execute SQL statements sequentially (async version for backward compatibility)
 * @deprecated Prefer using executeSQLStatements Effect version directly
 */
/* eslint-disable functional/no-expression-statements */
export const executeSQLStatementsAsync = async (
  tx: TransactionLike,
  statements: readonly string[]
): Promise<void> => {
  await Effect.runPromise(executeSQLStatements(tx, statements))
}
/* eslint-enable functional/no-expression-statements */

/**
 * Check if table exists (async version for backward compatibility)
 * @deprecated Prefer using tableExists Effect version directly
 */
export const tableExistsAsync = async (tx: TransactionLike, tableName: string): Promise<boolean> =>
  Effect.runPromise(tableExists(tx, tableName))

/**
 * Get existing columns (async version for backward compatibility)
 * @deprecated Prefer using getExistingColumns Effect version directly
 */
export const getExistingColumnsAsync = async (
  tx: TransactionLike,
  tableName: string
): Promise<ReadonlyMap<string, { dataType: string; isNullable: string }>> =>
  Effect.runPromise(getExistingColumns(tx, tableName))

/**
 * Get existing table names (async version for backward compatibility)
 * @deprecated Prefer using getExistingTableNames Effect version directly
 */
export const getExistingTableNamesAsync = async (tx: TransactionLike): Promise<readonly string[]> =>
  Effect.runPromise(getExistingTableNames(tx))

/**
 * Execute SQL statements in parallel (async version for backward compatibility)
 * @deprecated Prefer using executeSQLStatementsParallel Effect version directly
 */
/* eslint-disable functional/no-expression-statements */
export const executeSQLStatementsParallelAsync = async (
  tx: TransactionLike,
  statements: readonly string[]
): Promise<void> => {
  await Effect.runPromise(executeSQLStatementsParallel(tx, statements))
}
/* eslint-enable functional/no-expression-statements */
