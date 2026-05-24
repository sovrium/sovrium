/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { stringAggExpression } from '../sql/dialect-ddl'
import { toSingular, generateJunctionTableName } from '../sql/sql-generators'
import { generateSqlCondition } from '../table-queries/filter-operators'
import type { Fields } from '@/domain/models/app/tables/fields'
import type { ViewFilterCondition, ViewFilterNode } from '@/domain/models/app/tables/views/filters'

const flattenFilterNode = (node: ViewFilterNode): readonly ViewFilterCondition[] => {
  if ('and' in node) {
    return node.and.flatMap(flattenFilterNode)
  }
  if ('or' in node) {
    return node.or.flatMap(flattenFilterNode)
  }
  return [node]
}

const buildWhereClause = (filter: ViewFilterCondition, aliasPrefix: string): string => {
  const { field, operator, value } = filter
  const column = `${aliasPrefix}.${field}`
  return generateSqlCondition(column, operator, value, { useEscapeSqlString: true })
}

interface LookupExpressionOptions {
  readonly lookupName: string
  readonly relationshipField: string
  readonly relatedField: string
  readonly filters: ViewFilterCondition | undefined
  readonly tableAlias: string
  readonly actualTableName: string
}

const generateReverseLookupExpression = (options: LookupExpressionOptions): string => {
  const { lookupName, relationshipField, relatedField, filters, tableAlias, actualTableName } =
    options
  const lookupNameParts = lookupName.split('_')
  const relatedTable = lookupNameParts[lookupNameParts.length - 1] ?? actualTableName

  const alias = `${relatedTable}_for_${lookupName}`
  const baseCondition = `${alias}.${relationshipField} = ${tableAlias}.id`
  const whereConditions = filters
    ? [baseCondition, buildWhereClause(filters, alias)]
    : [baseCondition]
  const whereClause = whereConditions.join(' AND ')

  return `(
    SELECT ${stringAggExpression(`${alias}.${relatedField}`, ', ', `${alias}.${relatedField}`)}
    FROM ${relatedTable} AS ${alias}
    WHERE ${whereClause}
  ) AS ${lookupName}`
}

interface ManyToManyLookupOptions {
  readonly lookupName: string
  readonly relatedTable: string
  readonly relatedField: string
  readonly filters: ViewFilterCondition | undefined
  readonly tableAlias: string
  readonly actualTableName: string
}

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
    SELECT ${stringAggExpression(`${alias}.${relatedField}`, ', ', `${alias}.${relatedField}`)}
    FROM ${junctionTable} AS ${junctionAlias}
    INNER JOIN ${relatedTable} AS ${alias} ON ${joinCondition}
    WHERE ${whereClause}
  ) AS ${lookupName}`
}

interface ForwardLookupOptions {
  readonly lookupName: string
  readonly relationshipField: string
  readonly relatedTable: string
  readonly relatedField: string
  readonly filters: ViewFilterCondition | undefined
  readonly tableAlias: string
}

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

  return `${alias}.${relatedField} AS ${lookupName}`
}

const isManyToManyWithRelatedTable = (
  field: Fields[number]
): field is Fields[number] & { relationType: 'many-to-many'; relatedTable: string } =>
  'relationType' in field &&
  field.relationType === 'many-to-many' &&
  'relatedTable' in field &&
  typeof field.relatedTable === 'string'

const hasRelatedTable = (
  field: Fields[number]
): field is Fields[number] & { relatedTable: string } =>
  'relatedTable' in field && typeof field.relatedTable === 'string'

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

  if (!relationshipFieldDef || relationshipFieldDef.type !== 'relationship') {
    return generateReverseLookupExpression({ ...baseOptions, actualTableName })
  }

  if (isManyToManyWithRelatedTable(relationshipFieldDef)) {
    return generateManyToManyLookupExpression({
      ...baseOptions,
      relatedTable: relationshipFieldDef.relatedTable,
      actualTableName,
    })
  }

  if (hasRelatedTable(relationshipFieldDef)) {
    return generateForwardLookupExpression({
      ...baseOptions,
      relatedTable: relationshipFieldDef.relatedTable,
    })
  }

  return `NULL AS ${lookupName}`
}

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

export const generateCountExpression = (
  countField: Fields[number] & {
    readonly type: 'count'
    readonly relationshipField: string
    readonly filters?: ViewFilterNode
  },
  tableName: string,
  allFields: readonly Fields[number][]
): string => {
  const { name: countName, relationshipField, filters } = countField

  const relationshipFieldDef = allFields.find((f) => f.name === relationshipField)

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

  const foreignKeyColumn =
    'foreignKey' in relationshipFieldDef && typeof relationshipFieldDef.foreignKey === 'string'
      ? relationshipFieldDef.foreignKey
      : relationshipField

  const baseCondition = `${alias}.${foreignKeyColumn} = ${tableName}.id`

  const filterConditions = filters
    ? flattenFilterNode(filters).map((condition) => buildWhereClause(condition, alias))
    : []

  const whereConditions = [baseCondition, ...filterConditions]
  const whereClause = whereConditions.join(' AND ')

  return `COALESCE(
    (SELECT COUNT(*)
     FROM ${relatedTable} AS ${alias}
     WHERE ${whereClause}),
    0
  ) AS ${countName}`
}
