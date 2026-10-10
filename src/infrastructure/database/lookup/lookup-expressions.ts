/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { stringAggExpression } from '../sql/dialect-ddl'
import { generateJunctionTableName, junctionKeyColumns } from '../sql/sql-generators'
import {
  compileRelationalFilter,
  relatedAliasOf,
  relationNameOf,
  type RelatedFilterScope,
} from './lookup-view-helpers'
import type { ViewFilterNode } from '@/domain/models/app/tables/views/filters'

/**
 * Configuration for lookup expression generation
 */
export type LookupExpressionConfig = Pick<RelatedFilterScope, 'allTables'> & {
  readonly lookupName: string
  readonly relationshipField: string
  readonly relatedField: string
  readonly relatedTable: string
  readonly filters: ViewFilterNode | undefined
  readonly tableAlias: string
  readonly actualTableName: string
}

/**
 * Configuration for many-to-many lookup expression
 */
export type ManyToManyLookupConfig = Pick<RelatedFilterScope, 'allTables'> & {
  readonly lookupName: string
  readonly relatedTable: string
  /** The relation read for the related rows — the related table's base table when it is this table. */
  readonly relatedRelation?: string
  readonly relatedField: string
  readonly filters: ViewFilterNode | undefined
  readonly tableAlias: string
  readonly actualTableName: string
}

/**
 * Configuration for forward lookup expression
 */
export type ForwardLookupConfig = Pick<RelatedFilterScope, 'allTables'> & {
  readonly lookupName: string
  readonly relationshipField: string
  readonly relatedTable: string
  /** The relation read for the related row — the related table's base table when it is this table. */
  readonly relatedRelation?: string
  readonly relatedField: string
  readonly filters: ViewFilterNode | undefined
  readonly tableAlias: string
}

/**
 * A lookup through a link to MANY records copies the field of every linked
 * row that is still live: a row in the trash is logically gone, so it no more
 * contributes to the lookup than it does to a `rollup` or a `count` over the
 * same link (soft-delete-by-default gives every app table a `deleted_at`). The
 * records API's narrowed recompute (`many-to-many-lookup-narrowing.ts`) and the
 * read mask (`lookup-read-mask.ts`) read the live rows too, so every reader —
 * masked or not — reads the same value and a filter finds what the value shows.
 */
const notTrashed = (alias: string): string => `${alias}.deleted_at IS NULL`

/** The lookup's own `filters` as a WHERE list entry, or nothing when it restricts nothing. */
const filterConditionsOf = (
  filters: ViewFilterNode | undefined,
  alias: string,
  scope: RelatedFilterScope
): readonly string[] => {
  const condition = compileRelationalFilter(filters, alias, scope)
  return condition === undefined ? [] : [condition]
}

/**
 * Generate reverse lookup expression (one-to-many)
 */
export const generateReverseLookupExpression = (config: LookupExpressionConfig): string => {
  const { lookupName, relationshipField, relatedField, relatedTable, filters, tableAlias } = config

  const alias = relatedAliasOf(relatedTable, lookupName)
  const baseCondition = `${alias}.${quoteSqlIdentifier(relationshipField)} = ${tableAlias}.id`
  const filterConditions = filterConditionsOf(filters, alias, config)
  const whereConditions = [baseCondition, notTrashed(alias), ...filterConditions]
  const whereClause = whereConditions.join(' AND ')

  return `(
    SELECT ${stringAggExpression(`${alias}.${quoteSqlIdentifier(relatedField)}`, ', ', `${alias}.${quoteSqlIdentifier(relatedField)}`)}
    FROM ${relationNameOf(relatedTable)} AS ${alias}
    WHERE ${whereClause}
  ) AS ${lookupName}`
}

/**
 * Generate many-to-many lookup expression (through junction table)
 */
export const generateManyToManyLookupExpression = (config: ManyToManyLookupConfig): string => {
  const { lookupName, relatedTable, relatedField, filters, tableAlias, actualTableName } = config
  const alias = relatedAliasOf(relatedTable, lookupName)
  const junctionTable = relationNameOf(generateJunctionTableName(actualTableName, relatedTable))
  const junctionAlias = `junction_${lookupName}`
  const [foreignKeyInJunction, relatedForeignKeyInJunction] = junctionKeyColumns(
    actualTableName,
    relatedTable
  )

  const baseCondition = `${junctionAlias}.${quoteSqlIdentifier(foreignKeyInJunction)} = ${tableAlias}.id`
  const joinCondition = `${alias}.id = ${junctionAlias}.${quoteSqlIdentifier(relatedForeignKeyInJunction)}`
  const filterConditions = filterConditionsOf(filters, alias, config)
  const whereConditions = [baseCondition, notTrashed(alias), ...filterConditions]
  const whereClause = whereConditions.join(' AND ')

  return `(
    SELECT ${stringAggExpression(`${alias}.${quoteSqlIdentifier(relatedField)}`, ', ', `${alias}.${quoteSqlIdentifier(relatedField)}`)}
    FROM ${junctionTable} AS ${junctionAlias}
    INNER JOIN ${config.relatedRelation ?? relationNameOf(relatedTable)} AS ${alias} ON ${joinCondition}
    WHERE ${whereClause}
  ) AS ${lookupName}`
}

/**
 * Generate forward lookup expression (many-to-one)
 */
export const generateForwardLookupExpression = (config: ForwardLookupConfig): string => {
  const { lookupName, relationshipField, relatedTable, relatedField, filters, tableAlias } = config
  const alias = relatedAliasOf(relatedTable, lookupName)

  const whereClause = compileRelationalFilter(filters, alias, config)
  if (whereClause !== undefined) {
    return `(
      SELECT ${alias}.${quoteSqlIdentifier(relatedField)}
      FROM ${config.relatedRelation ?? relationNameOf(relatedTable)} AS ${alias}
      WHERE ${alias}.id = ${tableAlias}.${quoteSqlIdentifier(relationshipField)} AND ${whereClause}
    ) AS ${lookupName}`
  }

  // Direct column reference via LEFT JOIN (handled in main VIEW SELECT)
  return `${alias}.${quoteSqlIdentifier(relatedField)} AS ${quoteSqlIdentifier(lookupName)}`
}
