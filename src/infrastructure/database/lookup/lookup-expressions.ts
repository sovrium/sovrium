/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toSingular, generateJunctionTableName } from '../sql/sql-generators'
import { buildWhereClause } from './lookup-view-helpers'
import type { ViewFilterCondition } from '@/domain/models/app/table/views/filters'

/**
 * Configuration for lookup expression generation
 */
export type LookupExpressionConfig = {
  readonly lookupName: string
  readonly relationshipField: string
  readonly relatedField: string
  readonly filters: ViewFilterCondition | undefined
  readonly tableAlias: string
  readonly actualTableName: string
}

/**
 * Configuration for many-to-many lookup expression
 */
export type ManyToManyLookupConfig = {
  readonly lookupName: string
  readonly relatedTable: string
  readonly relatedField: string
  readonly filters: ViewFilterCondition | undefined
  readonly tableAlias: string
  readonly actualTableName: string
}

/**
 * Configuration for forward lookup expression
 */
export type ForwardLookupConfig = {
  readonly lookupName: string
  readonly relationshipField: string
  readonly relatedTable: string
  readonly relatedField: string
  readonly filters: ViewFilterCondition | undefined
  readonly tableAlias: string
}

/**
 * Generate reverse lookup expression (one-to-many)
 */
export const generateReverseLookupExpression = (config: LookupExpressionConfig): string => {
  const { lookupName, relationshipField, relatedField, filters, tableAlias, actualTableName } =
    config
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

/**
 * Generate forward lookup expression (many-to-one)
 */
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

  // Direct column reference via LEFT JOIN (handled in main VIEW SELECT)
  return `${alias}.${relatedField} AS ${lookupName}`
}
