/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TableSchema } from '@/domain/models/app/table'
import { detectCycles } from '@/domain/models/app/table/cycle-detection'

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
 * Detect circular relationship dependencies between tables.
 * A circular dependency exists when Table A references Table B, and Table B references Table A
 * (directly or through a chain of other tables).
 *
 * Self-referencing relationships (e.g., employees.manager → employees) are NOT considered circular
 * dependencies because they don't prevent table creation order determination.
 *
 * @param tables - Array of tables to validate
 * @returns Array of table names involved in circular dependencies, or empty array if none found
 */
const detectCircularRelationships = (
  tables: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<{
      readonly name: string
      readonly type: string
      readonly relatedTable?: string
    }>
  }>
): ReadonlyArray<string> => {
  // Build dependency graph: table name -> tables it references via relationship fields
  // Exclude self-references as they don't create circular dependencies
  const dependencyGraph: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
    tables.map((table) => {
      const relatedTables = table.fields
        .filter((field) => field.type === 'relationship' && field.relatedTable !== undefined)
        .map((field) => field.relatedTable as string)
        .filter((relatedTable) => relatedTable !== table.name) // Exclude self-references
      return [table.name, relatedTables] as const
    })
  )

  // Use shared cycle detection utility
  return detectCycles(dependencyGraph)
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
  Schema.filter((tables) => {
    const ids = tables.map((table) => table.id)
    const uniqueIds = new Set(ids)
    return ids.length === uniqueIds.size || 'Table IDs must be unique within the schema'
  }),
  Schema.filter((tables) => {
    const names = tables.map((table) => table.name)
    const uniqueNames = new Set(names)
    return names.length === uniqueNames.size || 'Table names must be unique within the schema'
  }),
  Schema.filter((tables) => {
    const circularTables = detectCircularRelationships(tables)
    if (circularTables.length > 0) {
      return `Circular relationship dependency detected: ${circularTables.join(' -> ')} - cannot resolve table creation order`
    }
    return true
  }),
  Schema.filter((tables) => {
    // Validate lookup fields reference existing relationship fields (either in same table or reverse relationship)
    const tablesByName = new Map(tables.map((table) => [table.name, table]))

    const invalidLookup = tables
      .flatMap((table) =>
        table.fields
          .filter((field) => field.type === 'lookup')
          .map((lookupField) => {
            const { relationshipField, relatedField } = lookupField as {
              relationshipField: string
              relatedField: string
            }

            // Check if relationshipField exists in the same table (forward lookup)
            const fieldInSameTable = table.fields.find((f) => f.name === relationshipField)
            if (fieldInSameTable) {
              // Relationship field found in same table - must be a relationship type
              if (fieldInSameTable.type !== 'relationship') {
                return {
                  table: table.name,
                  field: lookupField.name,
                  error: `relationshipField "${relationshipField}" must reference a relationship field`,
                }
              }

              // Get related table name from the relationship field
              const relatedTableName = (fieldInSameTable as { relatedTable?: string }).relatedTable
              if (relatedTableName) {
                const relatedTable = tablesByName.get(relatedTableName)
                if (relatedTable) {
                  // Check if relatedField exists in the related table
                  const relatedFieldExists = relatedTable.fields.some(
                    (f) => f.name === relatedField
                  )
                  if (!relatedFieldExists) {
                    return {
                      table: table.name,
                      field: lookupField.name,
                      error: `relatedField "${relatedField}" not found in related table "${relatedTableName}"`,
                    }
                  }
                }
              }

              return undefined
            }

            // Check if relationshipField exists in other tables (reverse lookup)
            const reverseRelationship = [...tablesByName.values()]
              .flatMap((otherTable) =>
                otherTable.fields
                  .filter(
                    (field) =>
                      field.type === 'relationship' &&
                      field.name === relationshipField &&
                      (field as { relatedTable?: string }).relatedTable === table.name
                  )
                  .map(() => ({ found: true, relatedTable: otherTable }))
              )
              .at(0)

            if (!reverseRelationship) {
              return {
                table: table.name,
                field: lookupField.name,
                error: `relationshipField "${relationshipField}" not found`,
              }
            }

            // For reverse lookup, check if relatedField exists in the table that has the relationship
            if (reverseRelationship.relatedTable) {
              const relatedFieldExists = reverseRelationship.relatedTable.fields.some(
                (f) => f.name === relatedField
              )
              if (!relatedFieldExists) {
                return {
                  table: table.name,
                  field: lookupField.name,
                  error: `relatedField "${relatedField}" not found in related table "${reverseRelationship.relatedTable.name}"`,
                }
              }
            }

            return undefined
          })
          .filter((error) => error !== undefined)
      )
      .at(0)

    if (invalidLookup) {
      return `Lookup field "${invalidLookup.table}.${invalidLookup.field}" ${invalidLookup.error}`
    }

    return true
  }),
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
