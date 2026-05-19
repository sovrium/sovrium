/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toSingular, generateJunctionTableName } from '../sql/sql-generators'
import { buildWhereClause } from './lookup-view-helpers'
import type { ViewFilterCondition } from '@/domain/models/app/tables/views/filters'

export type LookupExpressionConfig = {
  readonly lookupName: string
  readonly relationshipField: string
  readonly relatedField: string
  readonly relatedTable: string
  readonly filters: ViewFilterCondition | undefined
  readonly tableAlias: string
  readonly actualTableName: string
}

export type ManyToManyLookupConfig = {
  readonly lookupName: string
  readonly relatedTable: string
  readonly relatedField: string
  readonly filters: ViewFilterCondition | undefined
  readonly tableAlias: string
  readonly actualTableName: string
}

export type ForwardLookupConfig = {
  readonly lookupName: string
  readonly relationshipField: string
  readonly relatedTable: string
  readonly relatedField: string
  readonly filters: ViewFilterCondition | undefined
  readonly tableAlias: string
}

export const generateReverseLookupExpression = (config: LookupExpressionConfig): string => {
  const { lookupName, relationshipField, relatedField, relatedTable, filters, tableAlias } = config

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

export const generateManyToManyLookupExpression = (config: ManyToManyLookupConfig): string => {
  const { lookupName, relatedTable, relatedField, filters, tableAlias, actualTableName } = config
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

export const generateForwardLookupExpression = (config: ForwardLookupConfig): string => {
  const { lookupName, relationshipField, relatedTable, relatedField, filters, tableAlias } = config
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
