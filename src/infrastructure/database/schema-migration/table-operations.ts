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
  SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import { PROTECTED_SYSTEM_TABLES } from './constants'
import { detectAmbiguousTableRenames, detectTableRenames } from './rename-detection'
import type { Table } from '@/domain/models/app/tables'

/**
 * Whether `tableName` is a managed Better-Auth / system table that runtime
 * schema migration must never drop.
 *
 * On PostgreSQL the Better-Auth (`auth.*`) and system (`system.*`) tables live
 * in dedicated schemas, so `getExistingTableNames` (scoped to `public`) never
 * even returns them; the `PROTECTED_SYSTEM_TABLES` set is otherwise defensive.
 *
 * On SQLite there are no schemas: the `schema-sqlite/` mirror prefixes those
 * tables `auth_` / `system_`, and `getExistingTableNames` returns every
 * non-`sqlite_%` table in one flat namespace. So the SQLite arm protects any
 * `auth_`- or `system_`-prefixed physical table.
 */
const isProtectedTable = (tableName: string): boolean => {
  if (PROTECTED_SYSTEM_TABLES.has(tableName)) return true
  if (isSqliteRuntime()) {
    return tableName.startsWith('auth_') || tableName.startsWith('system_')
  }
  return false
}

/**
 * `DROP TABLE` statement for the active dialect.
 *
 * PostgreSQL supports `DROP TABLE … CASCADE` (drops dependent FK constraints
 * and objects). SQLite has no `CASCADE` clause on `DROP TABLE`; dependent
 * foreign keys are governed by their `ON DELETE` actions instead.
 */
const dropTableStatement = (tableName: string): string =>
  isSqliteRuntime() ? `DROP TABLE ${tableName}` : `DROP TABLE ${tableName} CASCADE`

/**
 * Diagnostic for a set of tables that exchange names in a single config edit.
 *
 * Deliberately actionable and dialect-neutral: the alternative is letting the
 * first `ALTER TABLE … RENAME TO` collide and surfacing the driver's
 * `relation "x" already exists`, which names one table, blames the database, and
 * leaves the author no way to tell a swap from an id renumbering.
 */
const ambiguousRenameMessage = (names: readonly string[]): string =>
  `Ambiguous table rename detected: [${[...names].toSorted().join(', ')}] exchange names in a single config change, ` +
  `so Sovrium cannot tell which existing table each name should follow and refuses to guess. ` +
  `Rename them one at a time — deploy an intermediate name first, then the final one — or give the tables ids that stay attached to the same data.`

/**
 * Rename tables that have changed names (same table ID, different name)
 * Uses ALTER TABLE RENAME TO to preserve data, indexes, and constraints
 *
 * Refuses the migration outright when the renames form a cycle: a name swap is
 * the one case where no evidence in the config can say which physical table each
 * name belongs to, and both available guesses move rows between tables.
 */
export const renameTablesIfNeeded = (
  tx: TransactionLike,
  tables: readonly Table[],
  previousSchema?: { readonly tables: readonly object[] }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const ambiguous = detectAmbiguousTableRenames(tables, previousSchema)
    if (ambiguous.length > 0) {
      return yield* new SQLExecutionError({ message: ambiguousRenameMessage(ambiguous) })
    }

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
      (tableName) => !schemaTableNames.has(tableName) && !isProtectedTable(tableName)
    )

    // Drop all obsolete tables sequentially (dialect-aware — SQLite has no CASCADE).
    const dropStatements = tablesToDrop.map(dropTableStatement)
    yield* executeSQLStatements(tx, dropStatements)
  })
