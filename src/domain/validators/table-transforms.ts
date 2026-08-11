/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { detectCycles } from '@/domain/validators/cycle-detection'

/**
 * Auto-generate table IDs for tables that don't have one
 *
 * Tables without explicit IDs get auto-generated numeric IDs.
 * IDs are assigned sequentially starting from the highest existing ID + 1.
 */
export const autoGenerateTableIds = (
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
 * Bidirectional relationships (one-to-many in one direction, many-to-one in the reverse) are also
 * NOT circular dependencies because the foreign key is always on the "many" side, allowing proper
 * table creation order (create "one" side first, then "many" side with FK).
 *
 * Circular dependencies are ALLOWED when at least one side allows NULL (required: false).
 * This enables the INSERT-UPDATE pattern:
 * 1. INSERT with NULL foreign key
 * 2. INSERT second table with reference to first
 * 3. UPDATE first table to complete the circular reference
 * PostgreSQL validates constraints at statement end, making this pattern valid.
 *
 * @param tables - Array of tables to validate
 * @returns Array of table names involved in circular dependencies, or empty array if none found
 */
export const detectCircularRelationships = (
  tables: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<{
      readonly name: string
      readonly type: string
      readonly relatedTable?: string
      readonly relationType?: string
      readonly required?: boolean
    }>
  }>
): ReadonlyArray<string> => {
  // Build dependency graph: table name -> tables it references via REQUIRED many-to-one relationships
  // We only track REQUIRED (NOT NULL) relationships because those prevent INSERT-UPDATE pattern
  // Optional (NULL-able) relationships can be created later via UPDATE after both tables exist
  const dependencyGraph: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
    tables.map((table) => {
      const relatedTables = table.fields
        .filter(
          (field) =>
            field.type === 'relationship' &&
            field.relatedTable !== undefined &&
            field.relatedTable !== table.name && // Exclude self-references
            (field.relationType === 'many-to-one' || field.relationType === undefined) && // Only track dependencies from FK side
            field.required !== false // Track required relationships (undefined = required by default, only false = optional)
        )
        .map((field) => field.relatedTable as string)
      return [table.name, relatedTables] as const
    })
  )

  // Use shared cycle detection utility
  return detectCycles(dependencyGraph)
}

/**
 * Detect circular permission inheritance between tables.
 * A circular permission inheritance exists when Table A inherits from Table B,
 * and Table B inherits from Table A (directly or through a chain of other tables).
 *
 * @param tables - Array of tables to validate
 * @returns Array of table names involved in circular permission inheritance, or empty array if none found
 */
export const detectCircularPermissionInheritance = (
  tables: ReadonlyArray<{
    readonly name: string
    readonly permissions?: {
      readonly inherit?: string
    }
  }>
): ReadonlyArray<string> => {
  // Build dependency graph: table name -> parent table it inherits permissions from
  const dependencyGraph: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
    tables.map((table) => {
      const inheritFrom = table.permissions?.inherit
      return [table.name, inheritFrom ? [inheritFrom] : []] as const
    })
  )

  // Use shared cycle detection utility
  return detectCycles(dependencyGraph)
}
