/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeSqlString, formatLikePattern } from './sql-utils'
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
    typeof value === 'string' ? `${column} = '${escapeSqlString(value)}'` : `${column} = ${value}`

  const operatorHandlers: Record<string, () => string> = {
    equals: equalsHandler,
    notEquals: () =>
      typeof value === 'string'
        ? `${column} != '${escapeSqlString(value)}'`
        : `${column} != ${value}`,
    greaterThan: () => `${column} > ${value}`,
    lessThan: () => `${column} < ${value}`,
    greaterThanOrEqual: () => `${column} >= ${value}`,
    lessThanOrEqual: () => `${column} <= ${value}`,
    contains: () => `${column} LIKE ${formatLikePattern(value, 'contains')}`,
    startsWith: () => `${column} LIKE ${formatLikePattern(value, 'startsWith')}`,
    endsWith: () => `${column} LIKE ${formatLikePattern(value, 'endsWith')}`,
    isNull: () => `${column} IS NULL`,
    isNotNull: () => `${column} IS NOT NULL`,
  }

  const handler = operatorHandlers[operator]
  return handler ? handler() : equalsHandler()
}

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
  if (
    'relatedTable' in relationshipFieldDef &&
    typeof relationshipFieldDef.relatedTable === 'string'
  ) {
    const { relatedTable } = relationshipFieldDef
    const alias = `${relatedTable}_for_${lookupName}`

    // Simple JOIN for forward lookup (filters not typical here, but supported)
    if (filters) {
      const whereClause = buildWhereClause(filters, alias)
      return `(
        SELECT ${alias}.${relatedField}
        FROM ${relatedTable} AS ${alias}
        WHERE ${alias}.id = ${tableName}.${relationshipField} AND ${whereClause}
      ) AS ${lookupName}`
    }

    // Direct column reference via LEFT JOIN (handled in main VIEW SELECT)
    // Preserve original type (no ::TEXT cast)
    return `${alias}.${relatedField} AS ${lookupName}`
  }

  // Fallback: NULL if relationship is invalid
  return `NULL AS ${lookupName}`
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
      const { relatedTable } = relationshipFieldDef as unknown as { relatedTable: string }
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

/**
 * Get base fields (non-lookup, non-id fields)
 */
const getBaseFields = (table: Table): readonly string[] =>
  table.fields
    .filter((field) => field.type !== 'lookup' && field.name !== 'id')
    .map((field) => field.name)

/**
 * Generate INSTEAD OF INSERT trigger for a VIEW
 */
const generateInsertTrigger = (
  viewName: string,
  baseTableName: string,
  baseFields: readonly string[]
): readonly string[] => {
  const insertTriggerFunction = `${viewName}_instead_of_insert`
  const insertTrigger = `${viewName}_insert_trigger`
  const insertFieldsList = baseFields.join(', ')
  const insertValuesList = baseFields.map((name) => `NEW.${name}`).join(', ')

  return [
    `CREATE OR REPLACE FUNCTION ${insertTriggerFunction}()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ${baseTableName} (${insertFieldsList})
  VALUES (${insertValuesList});
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${insertTrigger} ON ${viewName}`,
    `CREATE TRIGGER ${insertTrigger}
INSTEAD OF INSERT ON ${viewName}
FOR EACH ROW
EXECUTE FUNCTION ${insertTriggerFunction}()`,
  ]
}

/**
 * Generate INSTEAD OF UPDATE trigger for a VIEW
 */
const generateUpdateTrigger = (
  viewName: string,
  baseTableName: string,
  baseFields: readonly string[]
): readonly string[] => {
  const updateTriggerFunction = `${viewName}_instead_of_update`
  const updateTrigger = `${viewName}_update_trigger`
  const updateSetList = baseFields.map((name) => `${name} = NEW.${name}`).join(', ')

  return [
    `CREATE OR REPLACE FUNCTION ${updateTriggerFunction}()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ${baseTableName}
  SET ${updateSetList}
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${updateTrigger} ON ${viewName}`,
    `CREATE TRIGGER ${updateTrigger}
INSTEAD OF UPDATE ON ${viewName}
FOR EACH ROW
EXECUTE FUNCTION ${updateTriggerFunction}()`,
  ]
}

/**
 * Generate INSTEAD OF DELETE trigger for a VIEW
 */
const generateDeleteTrigger = (viewName: string, baseTableName: string): readonly string[] => {
  const deleteTriggerFunction = `${viewName}_instead_of_delete`
  const deleteTrigger = `${viewName}_delete_trigger`

  return [
    `CREATE OR REPLACE FUNCTION ${deleteTriggerFunction}()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM ${baseTableName}
  WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${deleteTrigger} ON ${viewName}`,
    `CREATE TRIGGER ${deleteTrigger}
INSTEAD OF DELETE ON ${viewName}
FOR EACH ROW
EXECUTE FUNCTION ${deleteTriggerFunction}()`,
  ]
}

/**
 * Generate INSTEAD OF triggers for a VIEW to make it writable
 * These triggers redirect INSERT/UPDATE/DELETE operations to the base table
 */
export const generateLookupViewTriggers = (table: Table): readonly string[] => {
  if (!shouldUseView(table)) {
    return [] // No VIEW, no triggers needed
  }

  const baseTableName = getBaseTableName(table.name)
  const viewName = table.name
  const baseFields = getBaseFields(table)

  return [
    ...generateInsertTrigger(viewName, baseTableName, baseFields),
    ...generateUpdateTrigger(viewName, baseTableName, baseFields),
    ...generateDeleteTrigger(viewName, baseTableName),
  ]
}
