/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { generateSqlCondition } from './filter-operators'
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
 * Check if a view name belongs to a table
 * Simple heuristic: view name contains table name or starts with table name
 */
const viewBelongsToTable = (viewName: string, tableName: string): boolean => {
  return viewName.includes(tableName) || viewName.startsWith(tableName.replace(/_/g, ''))
}

/**
 * Filter views that should be dropped (exist in DB but not in schema)
 */
const findObsoleteViews = (
  existingViews: ReadonlySet<string>,
  schemaViews: ReadonlySet<string>,
  tableName: string
): readonly string[] => {
  return Array.from(existingViews).filter(
    (viewName) => viewBelongsToTable(viewName, tableName) && !schemaViews.has(viewName)
  )
}

/**
 * Drop views that no longer exist in the schema
 * This is called before creating views to ensure clean state
 */
/* eslint-disable functional/no-expression-statements */
export const generateDropObsoleteViewsSQL = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  table: Table
): Promise<void> => {
  // Get existing regular views for this table
  const existingViewsResult = (await tx.unsafe(`
    SELECT viewname
    FROM pg_views
    WHERE schemaname = 'public'
  `)) as readonly { viewname: string }[]

  // Get existing materialized views for this table
  const existingMatViewsResult = (await tx.unsafe(`
    SELECT matviewname
    FROM pg_matviews
    WHERE schemaname = 'public'
  `)) as readonly { matviewname: string }[]

  const existingViews = new Set(existingViewsResult.map((r) => r.viewname))
  const existingMatViews = new Set(existingMatViewsResult.map((r) => r.matviewname))
  // Convert view IDs to strings (ViewId can be number or string)
  const schemaViews = new Set((table.views || []).map((v) => String(v.id)))

  // Find views to drop using shared logic
  const viewsToDrop = findObsoleteViews(existingViews, schemaViews, table.name)
  const matViewsToDrop = findObsoleteViews(existingMatViews, schemaViews, table.name)

  // Drop obsolete regular views
  await Promise.all(
    viewsToDrop.map((viewName) => tx.unsafe(`DROP VIEW IF EXISTS ${viewName} CASCADE`))
  )

  // Drop obsolete materialized views
  await Promise.all(
    matViewsToDrop.map((viewName) =>
      tx.unsafe(`DROP MATERIALIZED VIEW IF EXISTS ${viewName} CASCADE`)
    )
  )
}
/* eslint-enable functional/no-expression-statements */
