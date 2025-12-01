/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TableSchema } from '@/domain/models/app/table'
import type { TableId } from '@/domain/models/app/common/branded-ids'

/**
 * Table with optional ID (input type)
 * Used for decoding where ID can be auto-generated
 */
const TableWithOptionalIdSchema = Schema.Struct({
  id: Schema.optional(TableSchema.fields.id),
  name: TableSchema.fields.name,
  fields: TableSchema.fields.fields,
  primaryKey: TableSchema.fields.primaryKey,
  uniqueConstraints: TableSchema.fields.uniqueConstraints,
  indexes: TableSchema.fields.indexes,
  views: TableSchema.fields.views,
  permissions: TableSchema.fields.permissions,
})

/**
 * Data Tables
 *
 * Collection of database tables that define the data structure of your application.
 * Each table represents an entity (e.g., users, products, orders) with fields that
 * define the schema. Tables support relationships, indexes, constraints, and various
 * field types. Tables are the foundation of your application's data model and
 * determine what information can be stored and how it relates.
 *
 * Auto-generates IDs for tables without explicit IDs. IDs are assigned sequentially
 * starting from the highest existing ID + 1, or from 1 if no IDs exist.
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
export const TablesSchema = Schema.transform(
  Schema.Array(TableWithOptionalIdSchema),
  Schema.Array(TableSchema),
  {
    strict: true,
    decode: (tables) => {
      // Find the highest existing ID
      const existingIds = tables
        .map((table) => table.id)
        .filter((id): id is TableId => id !== undefined)
      const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0

      // Auto-generate IDs for tables without one
      const tablesWithIds = tables.reduce<
        { tables: Array<typeof tables[number] & { id: TableId }>; nextId: number }
      >(
        (acc, table) => ({
          tables: [
            ...acc.tables,
            table.id !== undefined ? { ...table, id: table.id } : { ...table, id: acc.nextId },
          ],
          nextId: table.id !== undefined ? acc.nextId : acc.nextId + 1,
        }),
        { tables: [], nextId: maxId + 1 }
      )

      return tablesWithIds.tables
    },
    encode: (tables) => tables,
  }
).pipe(
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
