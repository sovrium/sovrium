/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  getExistingTableNames,
  executeSQLStatements,
  type TransactionLike,
  type SQLExecutionError,
} from '../sql/sql-execution'
import { PROTECTED_SYSTEM_TABLES } from './constants'
import { detectTableRenames } from './rename-detection'
import type { Table } from '@/domain/models/app/tables'

const isProtectedTable = (tableName: string): boolean => {
  if (PROTECTED_SYSTEM_TABLES.has(tableName)) return true
  if (isSqliteRuntime()) {
    return (
      tableName.startsWith('auth_') || tableName.startsWith('system_') || tableName === 'audit_log'
    )
  }
  return false
}

const dropTableStatement = (tableName: string): string =>
  isSqliteRuntime() ? `DROP TABLE ${tableName}` : `DROP TABLE ${tableName} CASCADE`

export const renameTablesIfNeeded = (
  tx: TransactionLike,
  tables: readonly Table[],
  previousSchema?: { readonly tables: readonly object[] }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const tableRenames = detectTableRenames(tables, previousSchema)

    if (tableRenames.size === 0) return

    const renameStatements = Array.from(tableRenames.entries()).map(
      ([oldName, newName]) => `ALTER TABLE ${oldName} RENAME TO ${newName}`
    )

    yield* executeSQLStatements(tx, renameStatements)
  })

export const dropObsoleteTables = (
  tx: TransactionLike,
  tables: readonly Table[]
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const existingTableNames = yield* getExistingTableNames(tx)
    const schemaTableNames = new Set(tables.map((table) => table.name))
    const tablesToDrop = existingTableNames.filter(
      (tableName) => !schemaTableNames.has(tableName) && !isProtectedTable(tableName)
    )

    const dropStatements = tablesToDrop.map(dropTableStatement)
    yield* executeSQLStatements(tx, dropStatements)
  })
