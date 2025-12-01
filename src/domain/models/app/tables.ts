/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ParseResult, Schema } from 'effect'
import { TableSchema } from '@/domain/models/app/table'
import type { Table } from '@/domain/models/app/table'

// Input schema for tables (id is optional)
const TableInputSchema = Schema.Struct({
  id: Schema.optional(Schema.Number),
  name: Schema.String,
  fields: Schema.Array(Schema.Any), // Simplified for input
  primaryKey: Schema.optional(Schema.Any),
  uniqueConstraints: Schema.optional(Schema.Any),
  indexes: Schema.optional(Schema.Any),
  views: Schema.optional(Schema.Any),
  permissions: Schema.optional(Schema.Any),
})

/**
 * Auto-generate table IDs for tables that don't have one
 *
 * Tables without explicit IDs get auto-generated numeric IDs.
 * IDs are assigned sequentially starting from the highest existing ID + 1.
 */
const autoGenerateTableIds = (
  tables: ReadonlyArray<Record<string, unknown>>
): ReadonlyArray<Record<string, unknown>> => {
  // Find the highest existing numeric ID
  const maxId = tables.reduce((max, table) => {
    if (table.id !== undefined && typeof table.id === 'number') {
      return Math.max(max, table.id)
    }
    return max
  }, 0)

  // Assign IDs to tables without one using reduce (functional pattern)
  const { tablesWithIds } = tables.reduce<{
    tablesWithIds: ReadonlyArray<Record<string, unknown>>
    nextId: number
  }>(
    (acc, table) => {
      if (table.id === undefined) {
        return {
          tablesWithIds: [...acc.tablesWithIds, { ...table, id: acc.nextId }],
          nextId: acc.nextId + 1,
        }
      }
      return {
        ...acc,
        tablesWithIds: [...acc.tablesWithIds, table],
      }
    },
    { tablesWithIds: [], nextId: maxId + 1 }
  )

  return tablesWithIds
}

/**
 * Data Tables
 *
 * Collection of database tables that define the data structure of your application.
 * Each table represents an entity (e.g., users, products, orders) with fields that
 * define the schema. Tables support relationships, indexes, constraints, and various
 * field types. Tables are the foundation of your application's data model and
 * determine what information can be stored and how it relates.
 *
 * Table IDs can be:
 * - Explicit numeric IDs (e.g., 1, 2, 3)
 * - UUID strings (e.g., '550e8400-e29b-41d4-a716-446655440000')
 * - Simple string identifiers (e.g., 'products', 'users')
 * - Auto-generated (omit the id field and it will be assigned automatically)
 *
 * @example
 * ```typescript
 * const tables = [
 *   {
 *     id: 1,
 *     name: 'users',
 *     fields: [
 *       { id: 1, name: 'email', type: 'email', required: true },
 *       { id: 2, name: 'name', type: 'text', required: true }
 *     ]
 *   }
 * ]
 * ```
 *
 * @see docs/specifications/roadmap/tables.md for full specification
 */
export const TablesSchema = Schema.Array(TableSchema).pipe(
  Schema.transform(
    Schema.Array(TableSchema.pipe(Schema.annotations({ identifier: 'TableWithRequiredId' }))),
    {
      strict: true,
      decode: (tables) =>
        autoGenerateTableIds(tables as ReadonlyArray<Record<string, unknown>>) as ReadonlyArray<
          Schema.Schema.Type<typeof TableSchema>
        >,
      encode: (tables) => tables,
    }
  ),
  Schema.annotations({
    title: 'Data Tables',
    description:
      'Collection of database tables that define the data structure of your application. Each table represents an entity (e.g., users, products, orders) with fields that define the schema. Tables support relationships, indexes, constraints, and various field types. Tables are the foundation of your application data model and determine what information can be stored and how it relates.',
    examples: [
      [
        {
          id: 1,
          name: 'users',
          fields: [
            { id: 1, name: 'email', type: 'email' as const, required: true },
            { id: 2, name: 'name', type: 'single-line-text' as const, required: true },
          ],
        },
      ],
    ],
  })
)

export type Tables = Schema.Schema.Type<typeof TablesSchema>

// Re-export Table and TableSchema for convenience
export { TableSchema } from '@/domain/models/app/table'
export type { Table } from '@/domain/models/app/table'
