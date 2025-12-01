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
 * Data Tables
 *
 * Collection of database tables that define the data structure of your application.
 * Each table represents an entity (e.g., users, products, orders) with fields that
 * define the schema. Tables support relationships, indexes, constraints, and various
 * field types. Tables are the foundation of your application's data model and
 * determine what information can be stored and how it relates.
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
export const TablesSchema = Schema.Array(TableInputSchema).pipe(
  // Post-process transformation to ensure unique auto-generated IDs
  Schema.transformOrFail(
    Schema.Array(TableSchema),
    {
      strict: true,
      decode: (tables, _, _ast) => {
        // Auto-generate IDs for tables that don't have them
        // Find the maximum existing ID to avoid conflicts
        const existingIds = tables.map((t) => t.id).filter((id): id is number => id !== undefined)
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0

        // Generate IDs using functional reduce pattern
        const { result } = tables.reduce(
          (acc, table) => {
            // If table already has an ID, keep it
            if (table.id !== undefined) {
              return {
                ...acc,
                result: [...acc.result, table as Table],
              }
            }

            // Auto-generate ID for tables without one
            return {
              nextId: acc.nextId + 1,
              result: [
                ...acc.result,
                {
                  ...table,
                  id: acc.nextId,
                } as Table,
              ],
            }
          },
          { nextId: maxId + 1, result: [] as Table[] }
        )

        return ParseResult.succeed(result)
      },
      encode: (tables) => ParseResult.succeed(tables),
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
