/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Table } from '@/domain/models/app/table'
import type { View } from '@/domain/models/app/table/views'

/**
 * Escape a string value for safe SQL interpolation
 * Doubles single quotes to prevent SQL injection (PostgreSQL standard)
 */
const escapeSqlString = (value: string): string => {
  return value.replace(/'/g, "''")
}

/**
 * Format a value for SQL interpolation
 * Strings are escaped and quoted, numbers/booleans are used directly
 */
const formatSqlValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return `'${escapeSqlString(value)}'`
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value === null) {
    return 'NULL'
  }
  // For other types (objects, arrays), convert to JSON string
  return `'${escapeSqlString(JSON.stringify(value))}'`
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
    const conditions = filters.and.map((condition) => {
      if ('field' in condition && 'operator' in condition && 'value' in condition) {
        const { field, operator, value: rawValue } = condition

        // Map domain operators to SQL operators
        const operatorMap: Record<string, string> = {
          equals: '=',
          greaterThan: '>',
          lessThan: '<',
          greaterThanOrEqual: '>=',
          lessThanOrEqual: '<=',
        }

        const sqlOperator = operatorMap[operator]
        if (sqlOperator) {
          // Format value with proper escaping
          const formattedValue = formatSqlValue(rawValue)
          return `${field} ${sqlOperator} ${formattedValue}`
        }
      }
      return ''
    })

    const validConditions = conditions.filter((c) => c !== '')
    return validConditions.length > 0 ? `WHERE ${validConditions.join(' AND ')}` : ''
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
 * Drop views that no longer exist in the schema
 * This is called before creating views to ensure clean state
 */
/* eslint-disable functional/no-expression-statements */
export const generateDropObsoleteViewsSQL = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  table: Table
): Promise<void> => {
  // Get existing views for this table
  const existingViewsResult = (await tx.unsafe(`
    SELECT viewname
    FROM pg_views
    WHERE schemaname = 'public'
  `)) as readonly { viewname: string }[]

  const existingViews = new Set(existingViewsResult.map((r) => r.viewname))
  // Convert view IDs to strings (ViewId can be number or string)
  const schemaViews = new Set((table.views || []).map((v) => String(v.id)))

  // Find views to drop (exist in database but not in schema)
  const viewsToDrop = Array.from(existingViews).filter((viewName) => {
    // Only drop views that look like they belong to this table
    // Simple heuristic: view name contains table name or starts with table name
    const belongsToTable =
      viewName.includes(table.name) || viewName.startsWith(table.name.replace(/_/g, ''))
    return belongsToTable && !schemaViews.has(viewName)
  })

  // Drop obsolete views
  await Promise.all(
    viewsToDrop.map((viewName) => tx.unsafe(`DROP VIEW IF EXISTS ${viewName} CASCADE`))
  )
}
/* eslint-enable functional/no-expression-statements */
