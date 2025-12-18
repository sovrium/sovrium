/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Schema Dependency Sorting Utilities
 *
 * Functions for topological sorting of tables by foreign key dependencies.
 * Used by schema-initializer.ts to ensure tables are created in correct order.
 */

import { isRelationshipField } from './sql-generators'
import type { Table } from '@/domain/models/app/table'

/**
 * Detect tables involved in circular dependencies with at least one optional FK.
 * These tables can use the INSERT-UPDATE pattern and should have FK constraints
 * added after all tables are created.
 *
 * @param tables - Array of tables to check
 * @returns Set of table names involved in resolvable circular dependencies
 */
export const detectCircularDependenciesWithOptionalFK = (
  tables: readonly Table[]
): ReadonlySet<string> => {
  const tablesByName = new Map(tables.map((t) => [t.name, t]))
  const circularTables = new Set<string>()

  tables.forEach((table) => {
    const optionalRelationships = table.fields.filter(
      (field): field is typeof field & { relatedTable: string } =>
        isRelationshipField(field) &&
        field.relatedTable !== table.name && // Exclude self-references
        field.required === false // Explicitly optional FK (allows NULL)
    )

    optionalRelationships.forEach((field) => {
      const relatedTableName = field.relatedTable
      const relatedTable = tablesByName.get(relatedTableName)

      if (!relatedTable) return

      // Check if related table also has a relationship back to this table
      const hasReverseRelationship = relatedTable.fields.some(
        (f) => isRelationshipField(f) && f.relatedTable === table.name
      )

      if (hasReverseRelationship) {
        // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements
        circularTables.add(table.name)
        // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements
        circularTables.add(relatedTableName)
      }
    })
  })

  return circularTables
}

/**
 * Sort tables by foreign key dependencies using topological sort
 * Tables with no dependencies come first, tables with dependencies come after their referenced tables
 *
 * This ensures that when we CREATE TABLE statements, referenced tables exist before
 * tables that reference them via foreign keys.
 *
 * Algorithm: Kahn's algorithm for topological sorting (functional implementation)
 * - Build dependency graph (which tables does each table depend on)
 * - Process tables with no dependencies first
 * - Remove processed tables from dependency lists
 * - Repeat until all tables are processed
 *
 * Handles circular dependencies by detecting them and keeping original order for those tables.
 *
 * @param tables - Array of tables to sort
 * @returns Tables sorted by dependency order (no dependencies first)
 */
export const sortTablesByDependencies = (tables: readonly Table[]): readonly Table[] => {
  // Build dependency map: tableName -> Set of tables it depends on
  const tableMap = new Map(tables.map((t) => [t.name, t]))

  const initialDeps = new Map(
    tables.map((table) => {
      const deps = new Set(
        table.fields
          .filter(isRelationshipField)
          .map((f) => f.relatedTable)
          .filter((name): name is string => name !== undefined && name !== table.name)
      )
      return [table.name, deps]
    })
  )

  // Recursive helper to process tables in dependency order
  const processTable = (
    current: string,
    remaining: ReadonlyMap<string, Set<string>>,
    sorted: readonly Table[]
  ): readonly Table[] => {
    const table = tableMap.get(current)
    if (!table) return sorted

    // Add current table to sorted list
    const newSorted = [...sorted, table]

    // Remove current table from all dependency sets
    const updated = new Map(
      Array.from(remaining.entries()).map(([name, deps]) => {
        const newDeps = new Set(deps)
        // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, drizzle/enforce-delete-with-where
        newDeps.delete(current)
        return [name, newDeps]
      })
    )

    // Remove current table from remaining
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, drizzle/enforce-delete-with-where
    updated.delete(current)

    // Find next table with no dependencies
    const next = Array.from(updated.entries()).find(([, deps]) => deps.size === 0)

    if (next) {
      return processTable(next[0], updated, newSorted)
    }

    // No more tables with zero dependencies - check for remaining tables
    if (updated.size > 0) {
      // Circular dependency or remaining tables - add in original order
      return [...newSorted, ...tables.filter((t) => !newSorted.includes(t) && updated.has(t.name))]
    }

    return newSorted
  }

  // Find first table with no dependencies
  const first = Array.from(initialDeps.entries()).find(([, deps]) => deps.size === 0)

  if (first) {
    return processTable(first[0], initialDeps, [])
  }

  // All tables have dependencies (circular) - return original order
  return tables
}
