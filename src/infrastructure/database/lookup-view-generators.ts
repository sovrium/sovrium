/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { generateSqlCondition } from './filter-operators'
import { toSingular, generateJunctionTableName } from './sql-generators'
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
 * Check if a field is a rollup field
 */
const isRollupField = (
  field: Fields[number]
): field is Fields[number] & {
  type: 'rollup'
  relationshipField: string
  relatedField: string
  aggregation: string
  filters?: ViewFilterCondition
} =>
  field.type === 'rollup' &&
  'relationshipField' in field &&
  'relatedField' in field &&
  'aggregation' in field &&
  typeof field.relationshipField === 'string' &&
  typeof field.relatedField === 'string' &&
  typeof field.aggregation === 'string'

/**
 * Check if a field is a count field
 */
const isCountField = (
  field: Fields[number]
): field is Fields[number] & {
  type: 'count'
  relationshipField: string
  conditions?: readonly ViewFilterCondition[]
} =>
  field.type === 'count' &&
  'relationshipField' in field &&
  typeof field.relationshipField === 'string'

/**
 * Check if a table has any lookup fields
 */
export const hasLookupFields = (table: Table): boolean =>
  table.fields.some((field) => isLookupField(field))

/**
 * Check if a table has any rollup fields
 */
export const hasRollupFields = (table: Table): boolean =>
  table.fields.some((field) => isRollupField(field))

/**
 * Check if a table has any count fields
 */
export const hasCountFields = (table: Table): boolean =>
  table.fields.some((field) => isCountField(field))

/**
 * Build WHERE clause from filter condition
 */
const buildWhereClause = (filter: ViewFilterCondition, aliasPrefix: string): string => {
  const { field, operator, value } = filter
  const column = `${aliasPrefix}.${field}`
  // Use legacy string escaping mode for backward compatibility
  return generateSqlCondition(column, operator, value, { useEscapeSqlString: true })
}

/**
 * Generate reverse lookup expression (one-to-many)
 */
const generateReverseLookupExpression = (
  lookupName: string,
  relationshipField: string,
  relatedField: string,
  filters: ViewFilterCondition | undefined,
  tableAlias: string,
  actualTableName: string
): string => {
  // Infer table name from lookup field name (e.g., "active_tasks" → "tasks")
  const lookupNameParts = lookupName.split('_')
  const relatedTable = lookupNameParts[lookupNameParts.length - 1] ?? actualTableName

  const alias = `${relatedTable}_for_${lookupName}`
  const baseCondition = `${alias}.${relationshipField} = ${tableAlias}.id`
  const whereConditions = filters
    ? [baseCondition, buildWhereClause(filters, alias)]
    : [baseCondition]
  const whereClause = whereConditions.join(' AND ')

  return `(
    SELECT STRING_AGG(${alias}.${relatedField}::TEXT, ', ' ORDER BY ${alias}.${relatedField})
    FROM ${relatedTable} AS ${alias}
    WHERE ${whereClause}
  ) AS ${lookupName}`
}

/**
 * Generate many-to-many lookup expression (through junction table)
 */
const generateManyToManyLookupExpression = (
  lookupName: string,
  relatedTable: string,
  relatedField: string,
  filters: ViewFilterCondition | undefined,
  tableAlias: string,
  actualTableName: string
): string => {
  const alias = `${relatedTable}_for_${lookupName}`
  const junctionTable = generateJunctionTableName(actualTableName, relatedTable)
  const junctionAlias = `junction_${lookupName}`
  const foreignKeyInJunction = `${toSingular(actualTableName)}_id`
  const relatedForeignKeyInJunction = `${toSingular(relatedTable)}_id`

  const baseCondition = `${junctionAlias}.${foreignKeyInJunction} = ${tableAlias}.id`
  const joinCondition = `${alias}.id = ${junctionAlias}.${relatedForeignKeyInJunction}`
  const whereConditions = filters
    ? [baseCondition, buildWhereClause(filters, alias)]
    : [baseCondition]
  const whereClause = whereConditions.join(' AND ')

  return `(
    SELECT STRING_AGG(${alias}.${relatedField}::TEXT, ', ' ORDER BY ${alias}.${relatedField})
    FROM ${junctionTable} AS ${junctionAlias}
    INNER JOIN ${relatedTable} AS ${alias} ON ${joinCondition}
    WHERE ${whereClause}
  ) AS ${lookupName}`
}

/**
 * Generate forward lookup expression (many-to-one)
 */
const generateForwardLookupExpression = (
  lookupName: string,
  relationshipField: string,
  relatedTable: string,
  relatedField: string,
  filters: ViewFilterCondition | undefined,
  tableAlias: string
): string => {
  const alias = `${relatedTable}_for_${lookupName}`

  if (filters) {
    const whereClause = buildWhereClause(filters, alias)
    return `(
      SELECT ${alias}.${relatedField}
      FROM ${relatedTable} AS ${alias}
      WHERE ${alias}.id = ${tableAlias}.${relationshipField} AND ${whereClause}
    ) AS ${lookupName}`
  }

  // Direct column reference via LEFT JOIN (handled in main VIEW SELECT)
  return `${alias}.${relatedField} AS ${lookupName}`
}

/**
 * Generate lookup column expression
 * Handles forward (many-to-one), reverse (one-to-many), and many-to-many lookups
 */
const generateLookupExpression = (
  lookupField: Fields[number] & {
    readonly type: 'lookup'
    readonly relationshipField: string
    readonly relatedField: string
    readonly filters?: ViewFilterCondition
  },
  tableAlias: string,
  allFields: readonly Fields[number][],
  actualTableName: string
): string => {
  const { name: lookupName, relationshipField, relatedField, filters } = lookupField
  const relationshipFieldDef = allFields.find((f) => f.name === relationshipField)

  // Reverse lookup (relationship field not in current table)
  if (!relationshipFieldDef || relationshipFieldDef.type !== 'relationship') {
    return generateReverseLookupExpression(
      lookupName,
      relationshipField,
      relatedField,
      filters,
      tableAlias,
      actualTableName
    )
  }

  // Many-to-many lookup (via junction table)
  if (
    'relationType' in relationshipFieldDef &&
    relationshipFieldDef.relationType === 'many-to-many' &&
    'relatedTable' in relationshipFieldDef &&
    typeof relationshipFieldDef.relatedTable === 'string'
  ) {
    return generateManyToManyLookupExpression(
      lookupName,
      relationshipFieldDef.relatedTable,
      relatedField,
      filters,
      tableAlias,
      actualTableName
    )
  }

  // Forward lookup (many-to-one)
  if (
    'relatedTable' in relationshipFieldDef &&
    typeof relationshipFieldDef.relatedTable === 'string'
  ) {
    return generateForwardLookupExpression(
      lookupName,
      relationshipField,
      relationshipFieldDef.relatedTable,
      relatedField,
      filters,
      tableAlias
    )
  }

  // Fallback: NULL if relationship is invalid
  return `NULL AS ${lookupName}`
}

/**
 * Map aggregation function name to PostgreSQL aggregate function
 */
const mapAggregationToPostgres = (aggregation: string, relatedField: string): string => {
  const upperAgg = aggregation.toUpperCase()

  switch (upperAgg) {
    case 'SUM':
      return `SUM(${relatedField})`
    case 'COUNT':
      return `COUNT(${relatedField})`
    case 'AVG':
      return `AVG(${relatedField})`
    case 'MIN':
      return `MIN(${relatedField})`
    case 'MAX':
      return `MAX(${relatedField})`
    case 'COUNTA':
      return `COUNT(CASE WHEN ${relatedField} IS NOT NULL AND ${relatedField} != '' THEN 1 END)`
    case 'COUNTALL':
      return `COUNT(*)`
    case 'ARRAYUNIQUE':
      return `ARRAY_AGG(DISTINCT ${relatedField} ORDER BY ${relatedField})`
    default:
      return `SUM(${relatedField})`
  }
}

/**
 * Generate default value for empty aggregation results
 */
const getDefaultValueForAggregation = (aggregation: string): string => {
  const upperAgg = aggregation.toUpperCase()

  switch (upperAgg) {
    case 'AVG':
    case 'MIN':
    case 'MAX':
      return 'NULL'
    case 'ARRAYUNIQUE':
      return 'ARRAY[]::TEXT[]'
    default:
      return '0'
  }
}

/**
 * Generate rollup column expression with aggregation
 */
const generateRollupExpression = (
  rollupField: Fields[number] & {
    readonly type: 'rollup'
    readonly relationshipField: string
    readonly relatedField: string
    readonly aggregation: string
    readonly filters?: ViewFilterCondition
  },
  tableName: string,
  allFields: readonly Fields[number][]
): string => {
  const { name: rollupName, relationshipField, relatedField, aggregation, filters } = rollupField

  const relationshipFieldDef = allFields.find((f) => f.name === relationshipField)

  if (!relationshipFieldDef || relationshipFieldDef.type !== 'relationship') {
    return `${getDefaultValueForAggregation(aggregation)} AS ${rollupName}`
  }

  if (
    !('relatedTable' in relationshipFieldDef) ||
    typeof relationshipFieldDef.relatedTable !== 'string'
  ) {
    return `${getDefaultValueForAggregation(aggregation)} AS ${rollupName}`
  }

  const { relatedTable } = relationshipFieldDef
  const alias = `${relatedTable}_for_${rollupName}`

  const aggregationExpr = mapAggregationToPostgres(aggregation, `${alias}.${relatedField}`)
  const defaultValue = getDefaultValueForAggregation(aggregation)

  // Determine the foreign key column in the related table
  // For one-to-many relationships, the foreignKey property specifies the FK column in the related table
  // For many-to-one relationships, the relationship field itself is the FK column
  const foreignKeyColumn =
    'foreignKey' in relationshipFieldDef && typeof relationshipFieldDef.foreignKey === 'string'
      ? relationshipFieldDef.foreignKey
      : relationshipField

  const baseCondition = `${alias}.${foreignKeyColumn} = ${tableName}.id`
  const whereConditions = filters
    ? [baseCondition, buildWhereClause(filters, alias)]
    : [baseCondition]

  const whereClause = whereConditions.join(' AND ')

  // Use the VIEW name (not base table) for rollup queries
  // The VIEW will be created after all base tables exist, so it's safe to reference
  return `COALESCE(
    (SELECT ${aggregationExpr}
     FROM ${relatedTable} AS ${alias}
     WHERE ${whereClause}),
    ${defaultValue}
  ) AS ${rollupName}`
}

/**
 * Generate count column expression with optional filtering
 * Counts linked records from a relationship field, with optional conditions
 */
const generateCountExpression = (
  countField: Fields[number] & {
    readonly type: 'count'
    readonly relationshipField: string
    readonly conditions?: readonly ViewFilterCondition[]
  },
  tableName: string,
  allFields: readonly Fields[number][]
): string => {
  const { name: countName, relationshipField, conditions } = countField

  const relationshipFieldDef = allFields.find((f) => f.name === relationshipField)

  // Count field must reference a valid relationship field in same table
  if (!relationshipFieldDef || relationshipFieldDef.type !== 'relationship') {
    return `0 AS ${countName}`
  }

  if (
    !('relatedTable' in relationshipFieldDef) ||
    typeof relationshipFieldDef.relatedTable !== 'string'
  ) {
    return `0 AS ${countName}`
  }

  const { relatedTable } = relationshipFieldDef
  const alias = `${relatedTable}_for_${countName}`

  // Determine the foreign key column in the related table
  // For one-to-many relationships, the foreignKey property specifies the FK column in the related table
  // For many-to-one relationships, the relationship field itself is the FK column
  const foreignKeyColumn =
    'foreignKey' in relationshipFieldDef && typeof relationshipFieldDef.foreignKey === 'string'
      ? relationshipFieldDef.foreignKey
      : relationshipField

  // Build WHERE clause with base condition + optional filter conditions
  const baseCondition = `${alias}.${foreignKeyColumn} = ${tableName}.id`

  // Convert conditions array to WHERE clauses
  const filterConditions = conditions?.map((condition) => buildWhereClause(condition, alias)) ?? []

  const whereConditions = [baseCondition, ...filterConditions]
  const whereClause = whereConditions.join(' AND ')

  // Use COALESCE to ensure 0 instead of NULL when no records match
  return `COALESCE(
    (SELECT COUNT(*)
     FROM ${relatedTable} AS ${alias}
     WHERE ${whereClause}),
    0
  ) AS ${countName}`
}

/**
 * Generate CREATE VIEW statement for a table with lookup, rollup, and/or count fields
 * Replaces the base table with a VIEW that includes looked-up, aggregated, and counted columns
 * Returns empty string if table has no lookup, rollup, or count fields
 */
export const generateLookupViewSQL = (table: Table): string => {
  const lookupFields = table.fields.filter(isLookupField)
  const rollupFields = table.fields.filter(isRollupField)
  const countFields = table.fields.filter(isCountField)

  if (lookupFields.length === 0 && rollupFields.length === 0 && countFields.length === 0) {
    return '' // No lookup, rollup, or count fields - no VIEW needed
  }

  // Always include base.* to get all columns from the base table (including auto-generated id)
  // Then add lookup, rollup, and count fields as additional computed columns
  const baseFieldsWildcard = 'base.*'

  // Generate lookup expressions (subqueries or JOIN references)
  const lookupExpressions = lookupFields.map((field) =>
    generateLookupExpression(field, 'base', table.fields, table.name)
  )

  // Generate rollup expressions (aggregation subqueries)
  const rollupExpressions = rollupFields.map((field) =>
    generateRollupExpression(field, 'base', table.fields)
  )

  // Generate count expressions (COUNT subqueries with optional filtering)
  const countExpressions = countFields.map((field) =>
    generateCountExpression(field, 'base', table.fields)
  )

  // Determine if we need JOINs for forward lookups (many-to-one only, not many-to-many)
  const forwardLookups = lookupFields.filter((field) => {
    const relationshipFieldDef = table.fields.find((f) => f.name === field.relationshipField)
    return (
      relationshipFieldDef &&
      relationshipFieldDef.type === 'relationship' &&
      'relatedTable' in relationshipFieldDef &&
      'relationType' in relationshipFieldDef &&
      relationshipFieldDef.relationType !== 'many-to-many'
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
  const selectClause = [
    baseFieldsWildcard,
    ...lookupExpressions,
    ...rollupExpressions,
    ...countExpressions,
  ].join(',\n    ')

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
 * Check if a table should use a VIEW (has lookup, rollup, or count fields)
 */
export const shouldUseView = (table: Table): boolean =>
  hasLookupFields(table) || hasRollupFields(table) || hasCountFields(table)

/**
 * Get base fields (non-lookup, non-rollup, non-count, non-one-to-many, non-many-to-many, non-id fields)
 */
const getBaseFields = (table: Table): readonly string[] =>
  table.fields
    .filter((field) => {
      // Exclude lookup, rollup, and count fields (handled by VIEW)
      if (field.type === 'lookup' || field.type === 'rollup' || field.type === 'count') {
        return false
      }
      // Exclude one-to-many and many-to-many relationship fields (don't create columns)
      if (
        field.type === 'relationship' &&
        'relationType' in field &&
        (field.relationType === 'one-to-many' || field.relationType === 'many-to-many')
      ) {
        return false
      }
      // Exclude id field (auto-generated)
      if (field.name === 'id') {
        return false
      }
      return true
    })
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
