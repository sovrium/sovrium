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

const generateDropIndexStatements = (
  table: Table,
  previousTable:
    | {
        readonly name: string
        readonly fields?: readonly { name?: string; type?: string; indexed?: boolean }[]
        readonly indexes?: readonly { name: string }[]
      }
    | undefined
): readonly string[] => {
  if (!previousTable) return []

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

  const currentUniqueFields = new Set(
    table.fields.filter((f) => 'unique' in f && f.unique).map((f) => f.name)
  )

  const indexToUniqueFields = previousIndexedFields.filter((field) =>
    currentUniqueFields.has(field.name!)
  )

  const indexToUniqueDrops = indexToUniqueFields.map(
    (field) => `DROP INDEX IF EXISTS ${standardIndexName(table.name, field)}`
  )

  const previousCustomIndexes = previousTable.indexes?.map((idx) => idx.name) ?? []
  const currentCustomIndexes = table.indexes?.map((idx) => idx.name) ?? []

  const removedCustomIndexes = previousCustomIndexes.filter(
    (name) => !currentCustomIndexes.includes(name)
  )

  const customIndexDrops = removedCustomIndexes.map((name) => `DROP INDEX IF EXISTS ${name}`)

  return [...fieldIndexDrops, ...indexToUniqueDrops, ...customIndexDrops]
}

export const syncIndexes = (
  tx: TransactionLike,
  table: Table,
  previousSchema?: { readonly tables: readonly object[] }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const previousTable = previousSchema?.tables.find(
      (t: object) => 'name' in t && t.name === table.name
    ) as
      | {
          name: string
          fields?: readonly { name?: string; type?: string; indexed?: boolean }[]
          indexes?: readonly { name: string }[]
        }
      | undefined

    const dropStatements = generateDropIndexStatements(table, previousTable)

    const createStatements = generateIndexStatements(table)

    yield* executeSQLStatements(tx, [...dropStatements, ...createStatements])
  })
