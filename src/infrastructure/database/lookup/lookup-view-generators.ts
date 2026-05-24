/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { sanitizeTableName } from '../table-queries/shared/field-utils'
import {
  generateReverseLookupExpression,
  generateManyToManyLookupExpression,
  generateForwardLookupExpression,
} from './lookup-expressions'
import {
  buildWhereClause,
  flattenFilterNode,
  mapAggregationToPostgres,
  getDefaultValueForAggregation,
} from './lookup-view-helpers'
import {
  getBaseFields,
  generateInsertTrigger,
  generateUpdateTrigger,
  generateDeleteTrigger,
} from './lookup-view-triggers'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'
import type { ViewFilterCondition, ViewFilterNode } from '@/domain/models/app/tables/views/filters'

type LookupFieldInput = Fields[number] & {
  readonly type: 'lookup'
  readonly relationshipField: string
  readonly relatedField: string
  readonly filters?: ViewFilterCondition
}

const isLookupField = (field: Fields[number]): field is LookupFieldInput =>
  field.type === 'lookup' &&
  'relationshipField' in field &&
  'relatedField' in field &&
  typeof field.relationshipField === 'string' &&
  typeof field.relatedField === 'string'

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

const isCountField = (
  field: Fields[number]
): field is Fields[number] & {
  type: 'count'
  relationshipField: string
  filters?: ViewFilterNode
} =>
  field.type === 'count' &&
  'relationshipField' in field &&
  typeof field.relationshipField === 'string'

export const hasLookupFields = (table: Table): boolean =>
  table.fields.some((field) => isLookupField(field))

export const hasRollupFields = (table: Table): boolean =>
  table.fields.some((field) => isRollupField(field))

export const hasCountFields = (table: Table): boolean =>
  table.fields.some((field) => isCountField(field))

const isManyToMany = (field: Fields[number]): field is Fields[number] & { relatedTable: string } =>
  'relationType' in field &&
  field.relationType === 'many-to-many' &&
  'relatedTable' in field &&
  typeof field.relatedTable === 'string'

const hasRelatedTable = (
  field: Fields[number]
): field is Fields[number] & { relatedTable: string } =>
  'relatedTable' in field && typeof field.relatedTable === 'string'

const findReverseLookupTable = (
  relationshipField: string,
  currentTableName: string,
  allTables: readonly Table[]
): string | undefined => {
  const match = allTables
    .filter((table) => sanitizeTableName(table.name) !== currentTableName)
    .find((table) =>
      table.fields.some((f) => f.name === relationshipField && f.type === 'relationship')
    )
  return match ? sanitizeTableName(match.name) : undefined
}

type LookupContext = {
  readonly tableAlias: string
  readonly allFields: readonly Fields[number][]
  readonly actualTableName: string
  readonly allTables: readonly Table[]
}

const generateLookupExpression = (
  lookupField: LookupFieldInput,
  context: LookupContext
): string => {
  const { tableAlias, allFields, actualTableName, allTables } = context
  const { name: lookupName, relationshipField, relatedField, filters } = lookupField
  const relationshipFieldDef = allFields.find((f) => f.name === relationshipField)

  if (!relationshipFieldDef || relationshipFieldDef.type !== 'relationship') {
    const relatedTable =
      findReverseLookupTable(relationshipField, actualTableName, allTables) ?? actualTableName
    return generateReverseLookupExpression({
      lookupName,
      relationshipField,
      relatedField,
      relatedTable,
      filters,
      tableAlias,
      actualTableName,
    })
  }

  if (isManyToMany(relationshipFieldDef)) {
    return generateManyToManyLookupExpression({
      lookupName,
      relatedTable: relationshipFieldDef.relatedTable,
      relatedField,
      filters,
      tableAlias,
      actualTableName,
    })
  }

  if (hasRelatedTable(relationshipFieldDef)) {
    return generateForwardLookupExpression({
      lookupName,
      relationshipField,
      relatedTable: relationshipFieldDef.relatedTable,
      relatedField,
      filters,
      tableAlias,
    })
  }

  return `NULL AS ${lookupName}`
}

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

const generateCountExpression = (
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

const buildForwardLookupJoins = (
  lookupFields: readonly LookupFieldInput[],
  allFields: readonly Fields[number][]
): string => {
  const forwardLookups = lookupFields.filter((field) => {
    const relationshipFieldDef = allFields.find((f) => f.name === field.relationshipField)
    return (
      relationshipFieldDef &&
      relationshipFieldDef.type === 'relationship' &&
      'relatedTable' in relationshipFieldDef &&
      'relationType' in relationshipFieldDef &&
      relationshipFieldDef.relationType !== 'many-to-many'
    )
  })

  return forwardLookups
    .map((field) => {
      const relationshipFieldDef = allFields.find((f) => f.name === field.relationshipField)
      if (!relationshipFieldDef || relationshipFieldDef.type !== 'relationship') {
        return ''
      }
      const { relatedTable } = relationshipFieldDef as unknown as { relatedTable: string }
      const alias = `${relatedTable}_for_${field.name}`
      return `LEFT JOIN ${relatedTable} AS ${alias} ON ${alias}.id = base.${field.relationshipField}`
    })
    .filter((join) => join !== '')
    .join('\n  ')
}

export const generateLookupViewSQL = (table: Table, allTables: readonly Table[] = []): string => {
  const lookupFields = table.fields.filter(isLookupField)
  const rollupFields = table.fields.filter(isRollupField)
  const countFields = table.fields.filter(isCountField)

  if (lookupFields.length === 0 && rollupFields.length === 0 && countFields.length === 0) {
    return ''
  }

  const sanitized = sanitizeTableName(table.name)

  const baseFieldsWildcard = 'base.*'

  const lookupContext = {
    tableAlias: 'base',
    allFields: table.fields,
    actualTableName: sanitized,
    allTables,
  } as const
  const lookupExpressions = lookupFields.map((field) =>
    generateLookupExpression(field, lookupContext)
  )
  const rollupExpressions = rollupFields.map((field) =>
    generateRollupExpression(field, 'base', table.fields)
  )
  const countExpressions = countFields.map((field) =>
    generateCountExpression(field, 'base', table.fields)
  )

  const joins = buildForwardLookupJoins(lookupFields, table.fields)

  const selectClause = [
    baseFieldsWildcard,
    ...lookupExpressions,
    ...rollupExpressions,
    ...countExpressions,
  ].join(',\n    ')

  return `${isSqliteRuntime() ? 'CREATE VIEW' : 'CREATE OR REPLACE VIEW'} ${sanitized} AS
  SELECT
    ${selectClause}
  FROM ${sanitized}_base AS base
  ${joins ? joins : ''}`
}

export const getBaseTableName = (tableName: string): string => `${tableName}_base`

export const shouldUseView = (table: Table): boolean =>
  hasLookupFields(table) || hasRollupFields(table) || hasCountFields(table)

export const generateLookupViewTriggers = (table: Table): readonly string[] => {
  if (!shouldUseView(table)) {
    return []
  }
  if (isSqliteRuntime()) {
    return []
  }

  const sanitized = sanitizeTableName(table.name)
  const baseTableName = getBaseTableName(sanitized)
  const viewName = sanitized
  const baseFields = getBaseFields(table)

  return [
    ...generateInsertTrigger(viewName, baseTableName, baseFields),
    ...generateUpdateTrigger(viewName, baseTableName, baseFields),
    ...generateDeleteTrigger(viewName, baseTableName),
  ]
}
