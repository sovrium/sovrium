/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The computed columns of a lookup view: one SQL expression per lookup,
 * rollup and count field, and the forward-lookup joins they read through.
 *
 * Split out of `lookup-view-generators.ts`.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { aggregateSourceOf, type AggregateSource } from './lookup-aggregate-source'
import {
  generateReverseLookupExpression,
  generateManyToManyLookupExpression,
  generateForwardLookupExpression,
} from './lookup-expressions'
import {
  isCountField,
  isLookupField,
  isRollupField,
  type LookupFieldInput,
} from './lookup-field-kinds'
import { readThroughSelfLookup } from './lookup-self-read'
import {
  compileRelationalFilter,
  relatedAliasOf,
  relationNameOf,
  mapAggregationToSql,
  getDefaultValueForAggregation,
} from './lookup-view-helpers'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'
import type { ViewFilterNode } from '@/domain/models/app/tables/views/filters'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/**
 * The relation a view body reads for a related table.
 *
 * A table's VIEW carries its computed columns and has the table's own name;
 * its stored rows live in `<name>_base`. A view that read ITSELF — a lookup
 * through a relationship to its own table, an org chart's manager — is
 * circularly defined (SQLite refuses it, PostgreSQL cannot create it), so a
 * self-reference reads the base table: the related row's stored columns are
 * all a lookup through it reads. Every other related table is read through
 * its view, as before.
 */
const relationFor = (relatedTable: string, currentTable: string): string =>
  sanitizeTableName(relatedTable) === sanitizeTableName(currentTable)
    ? quoteSqlIdentifier(`${sanitizeTableName(relatedTable)}_base`)
    : relationNameOf(relatedTable)

/** Check if relationship field is many-to-many with valid related table */
const isManyToMany = (field: Fields[number]): field is Fields[number] & { relatedTable: string } =>
  'relationType' in field &&
  field.relationType === 'many-to-many' &&
  'relatedTable' in field &&
  typeof field.relatedTable === 'string'

/** Check if relationship field has valid related table */
const hasRelatedTable = (
  field: Fields[number]
): field is Fields[number] & { relatedTable: string } =>
  'relatedTable' in field && typeof field.relatedTable === 'string'

/** The table holding a relationship field that points back at this one (a reverse lookup's key). */
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
  readonly dialect: DatabaseDialect
  readonly tableAlias: string
  readonly allFields: readonly Fields[number][]
  readonly actualTableName: string
  readonly allTables: readonly Table[]
}

/** Generate lookup column expression for forward, reverse, and many-to-many lookups */
const generateLookupExpression = (
  lookupField: LookupFieldInput,
  context: LookupContext
): string => {
  const { allFields, actualTableName, allTables } = context
  const { name: lookupName, relationshipField, relatedField, filters } = lookupField
  const relationshipFieldDef = allFields.find((f) => f.name === relationshipField)

  // Reverse lookup (relationship field not in current table)
  if (!relationshipFieldDef || relationshipFieldDef.type !== 'relationship') {
    const relatedTable =
      findReverseLookupTable(relationshipField, actualTableName, allTables) ?? actualTableName
    return generateReverseLookupExpression({
      lookupName,
      relationshipField,
      relatedField,
      relatedTable,
      filters,
      ...context,
    })
  }

  // Many-to-many lookup (via junction table)
  if (isManyToMany(relationshipFieldDef)) {
    return generateManyToManyLookupExpression({
      lookupName,
      relatedTable: relationshipFieldDef.relatedTable,
      relationshipField,
      relatedRelation: relationFor(relationshipFieldDef.relatedTable, actualTableName),
      relatedField,
      filters,
      ...context,
    })
  }

  // Forward lookup (many-to-one)
  if (hasRelatedTable(relationshipFieldDef)) {
    const throughSelf = readThroughSelfLookup(lookupField, relationshipFieldDef.relatedTable, {
      actualTableName,
      allFields,
    })
    if (throughSelf !== undefined) return throughSelf
    return generateForwardLookupExpression({
      lookupName,
      relationshipField,
      relatedTable: relationshipFieldDef.relatedTable,
      relatedRelation: relationFor(relationshipFieldDef.relatedTable, actualTableName),
      relatedField,
      filters,
      ...context,
    })
  }

  // Fallback: NULL if relationship is invalid
  return `NULL AS ${lookupName}`
}

/**
 * Inputs a `rollup` / `count` expression needs beyond its own field definition.
 *
 * `tableAlias` is what the emitted SQL joins against (`base`); `parentTableName`
 * is the CONFIG name of the table declaring the computed field, which is what
 * the child's relationship fields point back at. The two are not
 * interchangeable, and conflating them is how foreign-key inference silently
 * finds nothing.
 */
interface ComputedFieldContext {
  readonly dialect: DatabaseDialect
  readonly tableAlias: string
  readonly parentTableName: string
  readonly allFields: readonly Fields[number][]
  readonly allTables: readonly Table[]
}

/**
 * The related table a `rollup` / `count` reads, the alias it reads it under,
 * and the FROM / join conditions for its relationship's direction — or
 * `undefined` when the relationship field is missing or names no table.
 */
const computedSourceOf = (
  computedFieldName: string,
  relationshipField: string,
  context: ComputedFieldContext
):
  | { readonly relatedTable: string; readonly alias: string; readonly source: AggregateSource }
  | undefined => {
  const { parentTableName } = context
  const def = context.allFields.find((f) => f.name === relationshipField)
  if (!def || def.type !== 'relationship' || !hasRelatedTable(def)) return undefined
  const { relatedTable } = def
  const alias = relatedAliasOf(relatedTable, computedFieldName)
  const source = aggregateSourceOf({
    relationshipFieldDef: def as Readonly<Record<string, unknown>>,
    relationshipFieldName: relationshipField,
    relatedTable,
    relatedRelation: relationFor(relatedTable, parentTableName),
    alias,
    computedFieldName,
    tableAlias: context.tableAlias,
    parentTableName,
    allTables: context.allTables,
  })
  return { relatedTable, alias, source }
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
    readonly filters?: ViewFilterNode
  },
  context: ComputedFieldContext
): string => {
  const { name: rollupName, relationshipField, relatedField, aggregation, filters } = rollupField
  const defaultValue = getDefaultValueForAggregation(context.dialect, aggregation)
  const computed = computedSourceOf(rollupName, relationshipField, context)
  if (computed === undefined) return `${defaultValue} AS ${rollupName}`
  const { relatedTable, alias, source } = computed

  const aggregationExpr = mapAggregationToSql(
    context.dialect,
    aggregation,
    `${alias}.${quoteSqlIdentifier(relatedField)}`
  )
  // Soft-deleted child rows must NOT contribute to the aggregate — a devoted /
  // trashed related record is logically gone (soft-delete-by-default: every app
  // table carries a `deleted_at` column). Without this, "un-voting" (soft-
  // deleting a pain_vote) never lowers the pain's rollup.
  const notDeleted = `${alias}.deleted_at IS NULL`
  const filterCondition = compileRelationalFilter(context.dialect, filters, alias, {
    allTables: context.allTables,
    relatedTable,
  })
  const whereClause = [
    ...source.where,
    notDeleted,
    ...(filterCondition ? [filterCondition] : []),
  ].join(' AND ')

  // Reads the related table's VIEW (created after every base table exists).
  return `COALESCE(
    (SELECT ${aggregationExpr}
     FROM ${source.from}
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
    readonly filters?: ViewFilterNode
  },
  context: ComputedFieldContext
): string => {
  const { name: countName, relationshipField, filters } = countField
  // A count must reference a valid relationship field of the same table.
  const computed = computedSourceOf(countName, relationshipField, context)
  if (computed === undefined) return `0 AS ${countName}`
  const { relatedTable, alias, source } = computed

  // Soft-deleted child rows must NOT be counted — a devoted / trashed related
  // record is logically gone (soft-delete-by-default: every app table carries a
  // `deleted_at` column). Without this, un-voting never lowers the count.
  const notDeleted = `${alias}.deleted_at IS NULL`

  // An and / or group keeps its own meaning (an `or` is no longer read as AND).
  const filterCondition = compileRelationalFilter(context.dialect, filters, alias, {
    allTables: context.allTables,
    relatedTable,
  })

  const whereConditions = [
    ...source.where,
    notDeleted,
    ...(filterCondition ? [filterCondition] : []),
  ]
  const whereClause = whereConditions.join(' AND ')

  // Use COALESCE to ensure 0 instead of NULL when no records match
  return `COALESCE(
    (SELECT COUNT(*)
     FROM ${source.from}
     WHERE ${whereClause}),
    0
  ) AS ${countName}`
}

/**
 * Build JOIN clauses for forward lookups (many-to-one only, not many-to-many)
 */
export const buildForwardLookupJoins = (
  lookupFields: readonly LookupFieldInput[],
  allFields: readonly Fields[number][],
  currentTable: string
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
      const { relatedTable } = relationshipFieldDef as { relatedTable: string }
      const alias = relatedAliasOf(relatedTable, field.name)
      // A linked record in the trash contributes nothing through a link to ONE
      // record either, as through a link to many (`lookup-expressions.ts`).
      return `LEFT JOIN ${relationFor(relatedTable, currentTable)} AS ${alias} ON ${alias}.id = base.${field.relationshipField} AND ${alias}.deleted_at IS NULL`
    })
    .filter((join) => join !== '')
    .join('\n  ')
}

/**
 * The view's SELECT list: `base.*` plus one expression per computed field.
 *
 * `base.*` always leads so every stored column stays addressable; the computed
 * columns are appended in lookup / rollup / count order.
 */
export const buildComputedSelectClause = (
  table: Table,
  allTables: readonly Table[],
  dialect: DatabaseDialect
): string => {
  const lookupContext = {
    dialect,
    tableAlias: 'base',
    allFields: table.fields,
    actualTableName: sanitizeTableName(table.name),
    allTables,
  } as const
  const computedContext = {
    dialect,
    tableAlias: 'base',
    parentTableName: table.name,
    allFields: table.fields,
    allTables,
  } as const

  return [
    'base.*',
    ...table.fields.filter(isLookupField).map((f) => generateLookupExpression(f, lookupContext)),
    ...table.fields.filter(isRollupField).map((f) => generateRollupExpression(f, computedContext)),
    ...table.fields.filter(isCountField).map((f) => generateCountExpression(f, computedContext)),
  ].join(',\n    ')
}
