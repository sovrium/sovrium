/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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

import { getViewBodyReferencedTables, shouldUseView } from '../lookup/lookup-view-generators'
import { isRelationshipField, relationshipFieldCreatesForeignKey } from '../sql/sql-generators'
import type { Table } from '@/domain/models/app/tables'

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
  // Collect circular table names (functional construction)
  const circularTableNames = tables.flatMap((table) => {
    const optionalRelationships = table.fields.filter(
      (field): field is typeof field & { relatedTable: string } =>
        isRelationshipField(field) &&
        field.relatedTable !== table.name && // Exclude self-references
        field.required === false // Explicitly optional FK (allows NULL)
    )

    return optionalRelationships.flatMap((field) => {
      const relatedTableName = field.relatedTable
      const relatedTable = tablesByName.get(relatedTableName)

      if (!relatedTable) return []

      // Check if related table also has a relationship back to this table
      const hasReverseRelationship = relatedTable.fields.some(
        (f) => isRelationshipField(f) && f.relatedTable === table.name
      )

      return hasReverseRelationship ? [table.name, relatedTableName] : []
    })
  })

  return new Set(circularTableNames)
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
          // Only many-to-one (and relationships without an explicit relationType)
          // place a FK on this table, so only they create a real table-creation
          // dependency on relatedTable. one-to-many / many-to-many fields put the
          // FK on the child / junction table and must NOT add a phantom edge here
          // (which would fabricate a cycle and break view-backed parent ordering).
          .filter(relationshipFieldCreatesForeignKey)
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
        // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, drizzle/enforce-delete-with-where -- Topological sort requires working copy mutation for efficiency; drizzle false positive (Set.delete not DB)
        newDeps.delete(current)
        return [name, newDeps]
      })
    )

    // Remove current table from remaining
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, drizzle/enforce-delete-with-where -- Topological sort requires working copy mutation for efficiency; drizzle false positive (Map.delete not DB)
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

/**
 * Sort tables by VIEW-BODY dependency order for CREATE VIEW emission.
 *
 * FK-topological order (`sortTablesByDependencies`) is correct for CREATE TABLE
 * but WRONG for CREATE VIEW when a view-backed table is also a lookup/rollup/
 * count SOURCE for another view. FK edges and view-body edges can point in
 * OPPOSITE directions:
 *
 *   - `events` carries FK columns TO `invoices`/`requests` (time attribution),
 *     so FK-sort places `events` AFTER them.
 *   - but the `invoices`/`requests` VIEW BODIES roll up `FROM events` (the VIEW),
 *     so the `events` view must be created BEFORE them.
 *
 * Under FK order the `invoices`/`requests` views are emitted first and reference
 * a not-yet-created `events` view → Postgres `CREATE VIEW` fails with
 * `relation "events" does not exist` and the app never boots. (SQLite defers
 * view-body validation to query time, so it boots either way — hence the bug is
 * Postgres-only.)
 *
 * This produces a stable topological order over VIEW-BODY edges: a view-backed
 * table is emitted only after every view-backed table its view body reads from.
 * Only view-backed tables constrain each other; non-view-backed tables (which
 * emit no VIEW) keep their relative input order. Base tables are already created
 * before any view, so view bodies reading from a plain base table need no
 * reordering — only view-on-view edges matter.
 */
export const sortTablesByViewDependencies = (tables: readonly Table[]): readonly Table[] => {
  const viewBackedNames = new Set(tables.filter((t) => shouldUseView(t)).map((t) => t.name))
  // Fewer than two views ⇒ no view-on-view edge is possible; keep input order.
  if (viewBackedNames.size < 2) return tables

  // Per-table view-body dependencies, narrowed to view-backed targets (a view
  // that reads only from base tables has no ordering constraint here).
  const viewDeps = new Map(
    tables.map((t) => {
      const deps = shouldUseView(t)
        ? Array.from(getViewBodyReferencedTables(t, tables)).filter(
            (name) => viewBackedNames.has(name) && name !== t.name
          )
        : []
      return [t.name, new Set(deps)] as const
    })
  )

  // Stable topological emit: each pass appends every not-yet-emitted table whose
  // view-body deps are all already emitted, preserving input order within a pass.
  const emit = (emitted: readonly Table[]): readonly Table[] => {
    const emittedNames = new Set(emitted.map((t) => t.name))
    const ready = tables.filter(
      (t) =>
        !emittedNames.has(t.name) &&
        Array.from(viewDeps.get(t.name) ?? new Set<string>()).every((dep) => emittedNames.has(dep))
    )
    if (ready.length === 0) {
      // No progress ⇒ an unexpected view-body cycle (invalid schema). Append the
      // remainder in input order to stay total and deterministic.
      return [...emitted, ...tables.filter((t) => !emittedNames.has(t.name))]
    }
    const next = [...emitted, ...ready]
    return next.length === tables.length ? next : emit(next)
  }

  return emit([])
}
