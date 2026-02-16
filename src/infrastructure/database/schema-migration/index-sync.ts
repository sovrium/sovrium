/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  executeSQLStatements,
  type TransactionLike,
  type SQLExecutionError,
} from '../sql/sql-execution'
import type { Table } from '@/domain/models/app/table'

/**
 * Helper to generate DROP INDEX statements for indexes that need to be removed
 */
const generateDropIndexStatements = (
  table: Table,
  previousTable:
    | {
        readonly name: string
        readonly fields?: readonly { name?: string; indexed?: boolean }[]
        readonly indexes?: readonly { name: string }[]
      }
    | undefined
): readonly string[] => {
  if (!previousTable) return []

  // Drop indexes for fields that no longer have indexed: true
  const previousIndexedFields =
    previousTable.fields
      ?.filter((f) => f.name && 'indexed' in f && f.indexed)
      .map((f) => f.name!) ?? []

  const currentIndexedFields = new Set(
    table.fields.filter((f) => 'indexed' in f && f.indexed).map((f) => f.name)
  )

  const removedIndexedFields = previousIndexedFields.filter(
    (fieldName) => !currentIndexedFields.has(fieldName)
  )

  const fieldIndexDrops = removedIndexedFields.map((fieldName) => {
    const indexName = `idx_${table.name}_${fieldName}`
    return `DROP INDEX IF EXISTS ${indexName}`
  })

  // Drop indexes for fields that changed from indexed to unique
  const currentUniqueFields = new Set(
    table.fields.filter((f) => 'unique' in f && f.unique).map((f) => f.name)
  )

  const indexToUniqueFields = previousIndexedFields.filter((fieldName) =>
    currentUniqueFields.has(fieldName)
  )

  const indexToUniqueDrops = indexToUniqueFields.map((fieldName) => {
    const indexName = `idx_${table.name}_${fieldName}`
    return `DROP INDEX IF EXISTS ${indexName}`
  })

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
    const { generateIndexStatements } = yield* Effect.promise(
      () => import('../generators/index-generators')
    )

    // Get previous table definition
    const previousTable = previousSchema?.tables.find(
      (t: object) => 'name' in t && t.name === table.name
    ) as
      | {
          name: string
          fields?: readonly { name?: string; indexed?: boolean }[]
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
