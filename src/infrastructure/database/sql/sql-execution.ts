/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'

export interface TransactionLike {
  readonly unsafe: (sql: string) => Promise<readonly unknown[]>
}

export class SQLExecutionError extends Data.TaggedError('SQLExecutionError')<{
  readonly message: string
  readonly sql?: string
  readonly cause?: unknown
}> {}

export interface ColumnInfo {
  readonly column_name: string
  readonly data_type: string
  readonly is_nullable: string
  readonly column_default: string | null
}

interface TableExistsResult {
  readonly exists: boolean
}

interface TableNameResult {
  readonly tablename: string
}

interface ViewNameResult {
  readonly viewname: string
}

interface MatViewNameResult {
  readonly matviewname: string
}


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

export const getExistingColumns = (
  tx: TransactionLike,
  tableName: string
): Effect.Effect<
  ReadonlyMap<string, { dataType: string; isNullable: string; columnDefault: string | null }>,
  SQLExecutionError
> =>
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
