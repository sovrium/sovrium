/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Expression generators for lookup, rollup, and count fields
 *
 * These functions generate SQL subquery expressions for computed columns
 * used in lookup VIEWs.
 */

import { generateSqlCondition } from './filter-operators'
import { toSingular, generateJunctionTableName } from './sql-generators'
import type { Fields } from '@/domain/models/app/table/fields'
import type { ViewFilterCondition } from '@/domain/models/app/table/views/filters'

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
 * Options for generating lookup expressions
 */
interface LookupExpressionOptions {
  readonly lookupName: string
  readonly relationshipField: string
  readonly relatedField: string
  readonly filters: ViewFilterCondition | undefined
  readonly tableAlias: string
  readonly actualTableName: string
}

/**
 * Generate reverse lookup expression (one-to-many)
 */
const generateReverseLookupExpression = (options: LookupExpressionOptions): string => {
  const { lookupName, relationshipField, relatedField, filters, tableAlias, actualTableName } =
    options
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
 * Options for many-to-many lookup expressions
 */
interface ManyToManyLookupOptions {
  readonly lookupName: string
  readonly relatedTable: string
  readonly relatedField: string
  readonly filters: ViewFilterCondition | undefined
  readonly tableAlias: string
  readonly actualTableName: string
}

/**
 * Generate many-to-many lookup expression (through junction table)
 */
const generateManyToManyLookupExpression = (options: ManyToManyLookupOptions): string => {
  const { lookupName, relatedTable, relatedField, filters, tableAlias, actualTableName } = options
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
 * Options for forward lookup expressions
 */
interface ForwardLookupOptions {
  readonly lookupName: string
  readonly relationshipField: string
  readonly relatedTable: string
  readonly relatedField: string
  readonly filters: ViewFilterCondition | undefined
  readonly tableAlias: string
}

/**
 * Generate forward lookup expression (many-to-one)
 */
const generateForwardLookupExpression = (options: ForwardLookupOptions): string => {
  const { lookupName, relationshipField, relatedTable, relatedField, filters, tableAlias } = options
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
 * Check if field is a many-to-many relationship with related table
 */
const isManyToManyWithRelatedTable = (
  field: Fields[number]
): field is Fields[number] & { relationType: 'many-to-many'; relatedTable: string } =>
  'relationType' in field &&
  field.relationType === 'many-to-many' &&
  'relatedTable' in field &&
  typeof field.relatedTable === 'string'

/**
 * Check if field has a related table
 */
const hasRelatedTable = (
  field: Fields[number]
): field is Fields[number] & { relatedTable: string } =>
  'relatedTable' in field && typeof field.relatedTable === 'string'

/**
 * Generate lookup column expression
 * Handles forward (many-to-one), reverse (one-to-many), and many-to-many lookups
 */
export const generateLookupExpression = (
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
  const baseOptions = { lookupName, relationshipField, relatedField, filters, tableAlias }

  // Reverse lookup (relationship field not in current table)
  if (!relationshipFieldDef || relationshipFieldDef.type !== 'relationship') {
    return generateReverseLookupExpression({ ...baseOptions, actualTableName })
  }

  // Many-to-many lookup (via junction table)
  if (isManyToManyWithRelatedTable(relationshipFieldDef)) {
    return generateManyToManyLookupExpression({
      ...baseOptions,
      relatedTable: relationshipFieldDef.relatedTable,
      actualTableName,
    })
  }

  // Forward lookup (many-to-one)
  if (hasRelatedTable(relationshipFieldDef)) {
    return generateForwardLookupExpression({
      ...baseOptions,
      relatedTable: relationshipFieldDef.relatedTable,
    })
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
export const generateRollupExpression = (
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
  const foreignKeyColumn =
    'foreignKey' in relationshipFieldDef && typeof relationshipFieldDef.foreignKey === 'string'
      ? relationshipFieldDef.foreignKey
      : relationshipField

  const baseCondition = `${alias}.${foreignKeyColumn} = ${tableName}.id`
  const whereConditions = filters
    ? [baseCondition, buildWhereClause(filters, alias)]
    : [baseCondition]

  const whereClause = whereConditions.join(' AND ')

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
export const generateCountExpression = (
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
