/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { generateIndexStatements, standardIndexName } from '../generators/index-generators'
import {
  executeSQLStatements,
  type TransactionLike,
  type SQLExecutionError,
} from '../sql/sql-execution'
import type { Table } from '@/domain/models/app/tables'

/**
 * Helper to generate DROP INDEX statements for indexes that need to be removed
 */
const generateDropIndexStatements = (
  table: Table,
  previousTable:
    | {
        readonly name: string
        // `type` is load-bearing, not decorative: `status` fields are indexed
        // under `idx_<table>_status`, not `idx_<table>_<fieldName>`. Narrowing it
        // away made the correct DROP name unrepresentable here.
        readonly fields?: readonly { name?: string; type?: string; indexed?: boolean }[]
        readonly indexes?: readonly { name: string }[]
      }
    | undefined
): readonly string[] => {
  if (!previousTable) return []

  // Keep the whole field, not just its name: `standardIndexName` needs `type` to
  // resolve the `status` special case, and the name must be built by the same
  // function the CREATE path uses or the two drift (see `standardIndexName`).
  const previousIndexedFields =
    previousTable.fields?.filter((f) => f.name && 'indexed' in f && f.indexed) ?? []

  const currentIndexedFields = new Set(
    table.fields.filter((f) => 'indexed' in f && f.indexed).map((f) => f.name)
  )

  const removedIndexedFields = previousIndexedFields.filter(
    (field) => !currentIndexedFields.has(field.name!)
  )

  const fieldIndexDrops = removedIndexedFields.map(
    (field) => `DROP INDEX IF EXISTS ${standardIndexName(table.name, field)}`
  )

  // Drop indexes for fields that changed from indexed to unique
  const currentUniqueFields = new Set(
    table.fields.filter((f) => 'unique' in f && f.unique).map((f) => f.name)
  )

  const indexToUniqueFields = previousIndexedFields.filter((field) =>
    currentUniqueFields.has(field.name!)
  )

  const indexToUniqueDrops = indexToUniqueFields.map(
    (field) => `DROP INDEX IF EXISTS ${standardIndexName(table.name, field)}`
  )

  // Drop custom indexes that were removed
  const previousCustomIndexes = previousTable.indexes?.map((idx) => idx.name) ?? []
  const currentCustomIndexes = table.indexes?.map((idx) => idx.name) ?? []

  const removedCustomIndexes = previousCustomIndexes.filter(
    (name) => !currentCustomIndexes.includes(name)
  )

  const customIndexDrops = removedCustomIndexes.map((name) => `DROP INDEX IF EXISTS ${name}`)

  return [...fieldIndexDrops, ...indexToUniqueDrops, ...customIndexDrops]
}

/**
 * Sync indexes for existing table
 * Drops indexes that are no longer needed and creates new indexes
 * This is needed when field indexed property changes or custom indexes are added/removed
 */
export const syncIndexes = (
  tx: TransactionLike,
  table: Table,
  previousSchema?: { readonly tables: readonly object[] }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Get previous table definition
    const previousTable = previousSchema?.tables.find(
      (t: object) => 'name' in t && t.name === table.name
    ) as
      | {
          name: string
          fields?: readonly { name?: string; type?: string; indexed?: boolean }[]
          indexes?: readonly { name: string }[]
        }
      | undefined

    // Determine which indexes should be dropped
    const dropStatements = generateDropIndexStatements(table, previousTable)

    // Generate CREATE INDEX statements for all current indexes
    const createStatements = generateIndexStatements(table)

    // Execute drop statements first, then create statements
    yield* executeSQLStatements(tx, [...dropStatements, ...createStatements])
  })
