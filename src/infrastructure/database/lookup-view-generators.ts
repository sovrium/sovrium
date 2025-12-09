/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Table } from '@/domain/models/app/table'
import type { Fields } from '@/domain/models/app/table/fields'
import type { ViewFilterCondition } from '@/domain/models/app/table/views/filters'

/**
 * Check if a field is a lookup field
 */
const isLookupField = (
  field: Fields[number]
): field is Fields[number] & {
  type: 'lookup'
  relationshipField: string
  relatedField: string
  filters?: ViewFilterCondition
} =>
  field.type === 'lookup' &&
  'relationshipField' in field &&
  'relatedField' in field &&
  typeof field.relationshipField === 'string' &&
  typeof field.relatedField === 'string'

/**
 * Check if a table has any lookup fields
 */
export const hasLookupFields = (table: Table): boolean =>
  table.fields.some((field) => isLookupField(field))

/**
 * Build WHERE clause from filter condition
 */
const buildWhereClause = (filter: ViewFilterCondition, aliasPrefix: string): string => {
  const { field, operator, value } = filter
  const column = `${aliasPrefix}.${field}`

  // Default equals handler
  const equalsHandler = (): string =>
    typeof value === 'string' ? `${column} = '${escapeSQLValue(value)}'` : `${column} = ${value}`

  const operatorHandlers: Record<string, () => string> = {
    equals: equalsHandler,
    notEquals: () => (typeof value === 'string' ? `${column} != '${escapeSQLValue(value)}'` : `${column} != ${value}`),
    greaterThan: () => `${column} > ${value}`,
    lessThan: () => `${column} < ${value}`,
    greaterThanOrEqual: () => `${column} >= ${value}`,
    lessThanOrEqual: () => `${column} <= ${value}`,
    contains: () => `${column} LIKE '%${escapeSQLValue(String(value))}%'`,
    startsWith: () => `${column} LIKE '${escapeSQLValue(String(value))}%'`,
    endsWith: () => `${column} LIKE '%${escapeSQLValue(String(value))}'`,
    isNull: () => `${column} IS NULL`,
    isNotNull: () => `${column} IS NOT NULL`,
  }

  const handler = operatorHandlers[operator]
  return handler ? handler() : equalsHandler()
}

/**
 * Escape SQL string values to prevent injection
 */
const escapeSQLValue = (value: string): string => value.replace(/'/g, "''")

/**
 * Generate lookup column expression
 * Handles both forward (many-to-one) and reverse (one-to-many) lookups
 */
const generateLookupExpression = (
  lookupField: Fields[number] & {
    type: 'lookup'
    relationshipField: string
    relatedField: string
    filters?: ViewFilterCondition
  },
  tableName: string,
  allFields: readonly Fields[number][]
): string => {
  const { name: lookupName, relationshipField, relatedField, filters } = lookupField

  // Find the relationship field in the current table
  const relationshipFieldDef = allFields.find((f) => f.name === relationshipField)

  if (!relationshipFieldDef || relationshipFieldDef.type !== 'relationship') {
    // Reverse lookup: relationshipField is in the RELATED table, not this table
    // Example: projects.active_tasks looks up tasks.title WHERE tasks.project_id = projects.id
    // Infer table name from lookup field name (e.g., "active_tasks" → "tasks")
    // Extract the last word which should be the table name (supports patterns like "active_tasks", "team_member_names")
    const lookupNameParts = lookupName.split('_')
    const relatedTable = lookupNameParts[lookupNameParts.length - 1] ?? tableName

    // Build subquery for reverse lookup with optional filtering
    const alias = `${relatedTable}_for_${lookupName}`
    const baseCondition = `${alias}.${relationshipField} = ${tableName}.id`
    const whereConditions = filters
      ? [baseCondition, buildWhereClause(filters, alias)]
      : [baseCondition]

    const whereClause = whereConditions.join(' AND ')

    // Use STRING_AGG with ORDER BY for comma-separated, alphabetically sorted results
    return `(
      SELECT STRING_AGG(${alias}.${relatedField}::TEXT, ', ' ORDER BY ${alias}.${relatedField})
      FROM ${relatedTable} AS ${alias}
      WHERE ${whereClause}
    ) AS ${lookupName}`
  }

  // Forward lookup (many-to-one): follow the foreign key
  if ('relatedTable' in relationshipFieldDef && typeof relationshipFieldDef.relatedTable === 'string') {
    const {relatedTable} = relationshipFieldDef
    const alias = `${relatedTable}_for_${lookupName}`

    // Simple JOIN for forward lookup (filters not typical here, but supported)
    if (filters) {
      const whereClause = buildWhereClause(filters, alias)
      return `(
        SELECT ${alias}.${relatedField}::TEXT
        FROM ${relatedTable} AS ${alias}
        WHERE ${alias}.id = ${tableName}.${relationshipField} AND ${whereClause}
      ) AS ${lookupName}`
    }

    // Direct column reference via LEFT JOIN (handled in main VIEW SELECT)
    return `${alias}.${relatedField}::TEXT AS ${lookupName}`
  }

  // Fallback: NULL if relationship is invalid
  return `NULL::TEXT AS ${lookupName}`
}

/**
 * Generate CREATE VIEW statement for a table with lookup fields
 * Replaces the base table with a VIEW that includes looked-up columns
 * Returns empty string if table has no lookup fields
 */
export const generateLookupViewSQL = (table: Table): string => {
  const lookupFields = table.fields.filter(isLookupField)

  if (lookupFields.length === 0) {
    return '' // No lookup fields - no VIEW needed
  }

  // Always include base.* to get all columns from the base table (including auto-generated id)
  // Then add lookup fields as additional computed columns
  const baseFieldsWildcard = 'base.*'

  // Generate lookup expressions (subqueries or JOIN references)
  const lookupExpressions = lookupFields.map((field) =>
    generateLookupExpression(field, 'base', table.fields)
  )

  // Determine if we need JOINs for forward lookups
  const forwardLookups = lookupFields.filter((field) => {
    const relationshipFieldDef = table.fields.find((f) => f.name === field.relationshipField)
    return (
      relationshipFieldDef &&
      relationshipFieldDef.type === 'relationship' &&
      'relatedTable' in relationshipFieldDef
    )
  })

  // Build JOIN clauses for forward lookups (if any)
  const joins = forwardLookups
    .map((field) => {
      const relationshipFieldDef = table.fields.find((f) => f.name === field.relationshipField)
      if (!relationshipFieldDef || relationshipFieldDef.type !== 'relationship') {
        return ''
      }
      const {relatedTable} = (relationshipFieldDef as unknown as { relatedTable: string })
      const alias = `${relatedTable}_for_${field.name}`
      return `LEFT JOIN ${relatedTable} AS ${alias} ON ${alias}.id = base.${field.relationshipField}`
    })
    .filter((join) => join !== '')
    .join('\n  ')

  // Assemble the final VIEW SQL
  const selectClause = [baseFieldsWildcard, ...lookupExpressions].join(',\n    ')

  return `CREATE OR REPLACE VIEW ${table.name} AS
  SELECT
    ${selectClause}
  FROM ${table.name}_base AS base
  ${joins ? joins : ''}`
}

/**
 * Generate base table name for a table with lookup fields
 * The actual table is named {table}_base, and the VIEW is named {table}
 */
export const getBaseTableName = (tableName: string): string => `${tableName}_base`

/**
 * Check if a table should use a VIEW (has lookup fields)
 */
export const shouldUseView = (table: Table): boolean => hasLookupFields(table)
