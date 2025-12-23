/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { generateSqlCondition } from './filter-operators'
import {
  getExistingViews,
  getExistingMaterializedViews,
  executeSQLStatements,
  type TransactionLike,
} from './sql-execution'
import type { Table } from '@/domain/models/app/table'
import type { View } from '@/domain/models/app/table/views'
import type { ViewFilterNode } from '@/domain/models/app/table/views/filters'

/**
 * Map filter nodes to SQL condition strings
 * Extracts field, operator, value from each condition and generates SQL
 * Handles leaf conditions only (not nested AND/OR groups)
 */
const mapFilterConditions = (nodes: readonly ViewFilterNode[]): readonly string[] => {
  return nodes
    .map((node) => {
      if ('field' in node && 'operator' in node && 'value' in node) {
        return generateSqlCondition(node.field, node.operator, node.value)
      }
      return ''
    })
    .filter((c) => c !== '')
}

/**
 * Generate SQL WHERE clause from view filters
 * Supports comparison operators (equals, greaterThan, lessThan, etc.)
 * Values are properly escaped to prevent SQL injection
 */
const generateWhereClause = (filters: View['filters']): string => {
  if (!filters) return ''

  // Handle AND filters
  if ('and' in filters && filters.and) {
    const conditions = mapFilterConditions(filters.and)
    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  }

  // Handle OR filters
  if ('or' in filters && filters.or) {
    const conditions = mapFilterConditions(filters.or)
    return conditions.length > 0 ? `WHERE ${conditions.join(' OR ')}` : ''
  }

  return ''
}

/**
 * Generate SQL ORDER BY clause from view sorts and groupBy
 * GroupBy takes precedence - when present, it's used for ordering
 * If both groupBy and sorts are present, groupBy is applied first
 */
const generateOrderByClause = (sorts: View['sorts'], groupBy: View['groupBy']): string => {
  // Build order items immutably
  const groupByItems = groupBy
    ? [`${groupBy.field} ${(groupBy.direction || 'asc').toUpperCase()}`]
    : []

  const sortItems =
    sorts && sorts.length > 0 && !groupBy
      ? sorts.map((sort) => `${sort.field} ${sort.direction.toUpperCase()}`)
      : []

  const orderItems = [...groupByItems, ...sortItems]

  return orderItems.length > 0 ? `ORDER BY ${orderItems.join(', ')}` : ''
}

/**
 * Generate CREATE VIEW or CREATE MATERIALIZED VIEW statement for a table view
 * PostgreSQL doesn't support IF NOT EXISTS for CREATE VIEW, so we drop first
 */
export const generateViewSQL = (table: Table, view: View): string => {
  const viewType = view.materialized ? 'MATERIALIZED VIEW' : 'VIEW'
  // Convert view.id to string (ViewId can be number or string)
  const viewIdStr = String(view.id)

  // If view has a custom query, use it directly
  if (view.query) {
    return `CREATE ${viewType} ${viewIdStr} AS ${view.query}`
  }

  // Otherwise, build query from filters, sorts, fields, groupBy
  const fields = view.fields && view.fields.length > 0 ? view.fields.join(', ') : '*'
  const whereClause = generateWhereClause(view.filters)
  const orderByClause = generateOrderByClause(view.sorts, view.groupBy)

  const clauses = [`SELECT ${fields}`, `FROM ${table.name}`, whereClause, orderByClause].filter(
    (clause) => clause !== ''
  )

  const query = clauses.join(' ')

  return `CREATE ${viewType} ${viewIdStr} AS ${query}`
}

/**
 * Generate all CREATE VIEW statements for a table
 */
export const generateTableViewStatements = (table: Table): readonly string[] => {
  if (!table.views || table.views.length === 0) return []

  return table.views.map((view) => generateViewSQL(table, view))
}

/**
 * Generate trigger to make a view read-only
 * PostgreSQL views can be automatically updatable if they meet certain criteria
 * To ensure views are truly read-only, we create INSTEAD OF triggers that reject modifications
 */
export const generateReadOnlyViewTrigger = (viewId: string | number): readonly string[] => {
  const viewIdStr = String(viewId)
  const triggerBaseName = `${viewIdStr}_readonly`

  return [
    // INSTEAD OF INSERT trigger
    `CREATE OR REPLACE FUNCTION ${triggerBaseName}_insert_fn()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'cannot insert into view "%"', TG_TABLE_NAME;
    END;
    $$ LANGUAGE plpgsql`,
    `CREATE TRIGGER ${triggerBaseName}_insert
    INSTEAD OF INSERT ON ${viewIdStr}
    FOR EACH ROW EXECUTE FUNCTION ${triggerBaseName}_insert_fn()`,

    // INSTEAD OF UPDATE trigger
    `CREATE OR REPLACE FUNCTION ${triggerBaseName}_update_fn()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'cannot update view "%"', TG_TABLE_NAME;
    END;
    $$ LANGUAGE plpgsql`,
    `CREATE TRIGGER ${triggerBaseName}_update
    INSTEAD OF UPDATE ON ${viewIdStr}
    FOR EACH ROW EXECUTE FUNCTION ${triggerBaseName}_update_fn()`,

    // INSTEAD OF DELETE trigger
    `CREATE OR REPLACE FUNCTION ${triggerBaseName}_delete_fn()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'cannot delete from view "%"', TG_TABLE_NAME;
    END;
    $$ LANGUAGE plpgsql`,
    `CREATE TRIGGER ${triggerBaseName}_delete
    INSTEAD OF DELETE ON ${viewIdStr}
    FOR EACH ROW EXECUTE FUNCTION ${triggerBaseName}_delete_fn()`,
  ]
}

/**
 * Drop views that no longer exist in the schema
 * Called once for all tables to ensure clean state before creating views
 */
/* eslint-disable functional/no-expression-statements */
export const generateDropObsoleteViewsSQL = async (
  tx: TransactionLike,
  tables: readonly Table[]
): Promise<void> => {
  // Get existing views using Effect-based queries
  const program = Effect.gen(function* () {
    // Query both view types in parallel
    const [existingViewNames, existingMatViewNames] = yield* Effect.all(
      [getExistingViews(tx), getExistingMaterializedViews(tx)],
      { concurrency: 2 }
    )

    const existingViews = new Set(existingViewNames)
    const existingMatViews = new Set(existingMatViewNames)

    // Collect ALL view IDs from schema (across all tables)
    const allSchemaViewIds = new Set<string>(
      tables.flatMap((table) =>
        table.views && table.views.length > 0 ? table.views.map((view) => String(view.id)) : []
      )
    )

    // Find views to drop: exist in DB but not in schema
    const viewsToDrop = Array.from(existingViews).filter((viewName) => !allSchemaViewIds.has(viewName))
    const matViewsToDrop = Array.from(existingMatViews).filter((viewName) => !allSchemaViewIds.has(viewName))

    // Generate DROP statements
    const dropViewStatements = viewsToDrop.map(
      (viewName) => `DROP VIEW IF EXISTS ${viewName} CASCADE`
    )
    const dropMatViewStatements = matViewsToDrop.map(
      (viewName) => `DROP MATERIALIZED VIEW IF EXISTS ${viewName} CASCADE`
    )

    // Execute all DROP statements sequentially (not in parallel)
    // Sequential execution ensures CASCADE dependencies are handled correctly
    // When dropping view A that view B depends on, CASCADE will drop B automatically
    // If we then try to drop B, IF EXISTS makes it a no-op
    yield* executeSQLStatements(tx, [...dropViewStatements, ...dropMatViewStatements])
  })

  await Effect.runPromise(program)
}
/* eslint-enable functional/no-expression-statements */

/**
 * Drop all views that are not defined in any table's schema
 * This ensures orphaned views (manually created or from previous schemas) are cleaned up
 */
/* eslint-disable functional/no-expression-statements */
export const dropAllObsoleteViews = async (
  tx: TransactionLike,
  tables: readonly Table[]
): Promise<void> => {
  const program = Effect.gen(function* () {
    // Query both view types in parallel
    const [existingViewNames, existingMatViewNames] = yield* Effect.all(
      [getExistingViews(tx), getExistingMaterializedViews(tx)],
      { concurrency: 2 }
    )

    // Collect all view IDs from all tables
    const allSchemaViews = new Set<string>()
    tables.forEach((table) => {
      if (table.views) {
        table.views.forEach((view) => {
          // eslint-disable-next-line functional/immutable-data
          allSchemaViews.add(String(view.id))
        })
      }
    })

    // Find views to drop - any view in DB that's not in schema
    const viewsToDrop = existingViewNames.filter((viewName) => !allSchemaViews.has(viewName))
    const matViewsToDrop = existingMatViewNames.filter(
      (viewName) => !allSchemaViews.has(viewName)
    )

    // Generate DROP statements with CASCADE
    const dropViewStatements = viewsToDrop.map(
      (viewName) => `DROP VIEW IF EXISTS ${viewName} CASCADE`
    )
    const dropMatViewStatements = matViewsToDrop.map(
      (viewName) => `DROP MATERIALIZED VIEW IF EXISTS ${viewName} CASCADE`
    )

    // Execute all DROP statements in parallel
    if (dropViewStatements.length > 0 || dropMatViewStatements.length > 0) {
      yield* executeSQLStatementsParallel(tx, [...dropViewStatements, ...dropMatViewStatements])
    }
  })

  await Effect.runPromise(program)
}
/* eslint-enable functional/no-expression-statements */
