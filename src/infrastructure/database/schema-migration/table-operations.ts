/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  getExistingTableNames,
  executeSQLStatements,
  type TransactionLike,
  type SQLExecutionError,
} from '../sql-execution'
import { PROTECTED_SYSTEM_TABLES } from './constants'
import { detectTableRenames } from './rename-detection'
import type { Table } from '@/domain/models/app/table'

/**
 * Rename tables that have changed names (same table ID, different name)
 * Uses ALTER TABLE RENAME TO to preserve data, indexes, and constraints
 */
export const renameTablesIfNeeded = (
  tx: TransactionLike,
  tables: readonly Table[],
  previousSchema?: { readonly tables: readonly object[] }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const tableRenames = detectTableRenames(tables, previousSchema)

    if (tableRenames.size === 0) return

    // Generate ALTER TABLE RENAME TO statements
    const renameStatements = Array.from(tableRenames.entries()).map(
      ([oldName, newName]) => `ALTER TABLE ${oldName} RENAME TO ${newName}`
    )

    yield* executeSQLStatements(tx, renameStatements)
  })

/**
 * Drop tables that exist in database but are not defined in schema
 *
 * SECURITY NOTE: Table names are validated before reaching this function.
 * This is SAFE because:
 * 1. existingTableNames comes from pg_tables system catalog (trusted source)
 * 2. schemaTableNames comes from validated Effect Schema objects
 * 3. Only tables not in schema are dropped (explicit comparison)
 * 4. Better Auth system tables are protected and never dropped
 */
export const dropObsoleteTables = (
  tx: TransactionLike,
  tables: readonly Table[]
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const existingTableNames = yield* getExistingTableNames(tx)
    const schemaTableNames = new Set(tables.map((table) => table.name))
    const tablesToDrop = existingTableNames.filter(
      (tableName) => !schemaTableNames.has(tableName) && !PROTECTED_SYSTEM_TABLES.has(tableName)
    )

    // Drop all obsolete tables sequentially
    const dropStatements = tablesToDrop.map((tableName) => `DROP TABLE ${tableName} CASCADE`)
    yield* executeSQLStatements(tx, dropStatements)
  })
