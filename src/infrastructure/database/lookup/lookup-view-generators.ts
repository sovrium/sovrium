/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { getViewFormulaLayers, buildLayeredViewSQL } from '../formula/view-formula-generators'
import {
  generateReverseLookupExpression,
  generateManyToManyLookupExpression,
  generateForwardLookupExpression,
} from './lookup-expressions'
import { resolveForeignKeyColumn } from './lookup-foreign-key'
import {
  buildWhereClause,
  flattenFilterNode,
  mapAggregationToSql,
  getDefaultValueForAggregation,
} from './lookup-view-helpers'
import {
  getBaseFields,
  getUpdateBaseFields,
  getInsertValueExpressions,
  getInsertIdExpression,
  generateInsertTrigger,
  generateUpdateTrigger,
  generateDeleteTrigger,
  generateInsertTriggerSqlite,
  generateUpdateTriggerSqlite,
  generateDeleteTriggerSqlite,
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

/**
 * Check if a field is a lookup field
 */
const isLookupField = (field: Fields[number]): field is LookupFieldInput =>
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
  filters?: ViewFilterNode
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
 * The set of OTHER table names that a table's generated VIEW BODY reads from.
 *
 * A `lookup` field JOINs to its relationship's related table; a `rollup`/`count`
 * field subqueries `FROM <relatedTable>` (the VIEW name, not the base table).
 * When any of those related tables is ALSO view-backed, the referencing VIEW
 * must be created AFTER the referenced VIEW — on Postgres the referenced
 * relation must already exist at `CREATE VIEW` time, or schema-init fails with
 * `relation "<name>" does not exist`. This is the dependency signal used to
 * order view creation (see `sortTablesByViewDependencies`).
 *
 * Returns raw config table names (matching `table.name`), so callers can filter
 * against the view-backed set directly.
 */
export const getViewBodyReferencedTables = (
  table: Table,
  allTables: readonly Table[]
): ReadonlySet<string> => {
  const referenced = table.fields.flatMap((field) => {
    if (isRollupField(field) || isCountField(field) || isLookupField(field)) {
      const relationshipFieldDef = table.fields.find((f) => f.name === field.relationshipField)
      if (
        relationshipFieldDef &&
        relationshipFieldDef.type === 'relationship' &&
        'relatedTable' in relationshipFieldDef &&
        typeof relationshipFieldDef.relatedTable === 'string'
      ) {
        return [relationshipFieldDef.relatedTable]
      }
      // Reverse lookup: the FK lives on another table whose relationship field
      // points back here — the view JOINs to that other table.
      if (isLookupField(field)) {
        const reverse = allTables.find(
          (t) =>
            t.name !== table.name &&
            t.fields.some((f) => f.name === field.relationshipField && f.type === 'relationship')
        )
        return reverse ? [reverse.name] : []
      }
    }
    return []
  })
  return new Set(referenced)
}

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

/**
 * Find the table containing a relationship field that points back to the current table.
 * Used for reverse lookups where the FK is in another table.
 */
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

/** Generate lookup column expression for forward, reverse, and many-to-many lookups */
const generateLookupExpression = (
  lookupField: LookupFieldInput,
  context: LookupContext
): string => {
  const { tableAlias, allFields, actualTableName, allTables } = context
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
      tableAlias,
      actualTableName,
    })
  }

  // Many-to-many lookup (via junction table)
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

  // Forward lookup (many-to-one)
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
  readonly tableAlias: string
  readonly parentTableName: string
  readonly allFields: readonly Fields[number][]
  readonly allTables: readonly Table[]
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
  context: ComputedFieldContext
): string => {
  const { name: rollupName, relationshipField, relatedField, aggregation, filters } = rollupField
  const { tableAlias, parentTableName, allFields, allTables } = context

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

  const aggregationExpr = mapAggregationToSql(aggregation, `${alias}.${relatedField}`)
  const defaultValue = getDefaultValueForAggregation(aggregation)

  const foreignKeyColumn = resolveForeignKeyColumn(
    relationshipFieldDef as unknown as Readonly<Record<string, unknown>>,
    relationshipField,
    parentTableName,
    allTables
  )

  const baseCondition = `${alias}.${foreignKeyColumn} = ${tableAlias}.id`
  // Soft-deleted child rows must NOT contribute to the aggregate — a devoted /
  // trashed related record is logically gone (soft-delete-by-default: every app
  // table carries a `deleted_at` column). Without this, "un-voting" (soft-
  // deleting a pain_vote) never lowers the pain's rollup.
  const notDeleted = `${alias}.deleted_at IS NULL`
  const whereConditions = filters
    ? [baseCondition, notDeleted, buildWhereClause(filters, alias)]
    : [baseCondition, notDeleted]

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
    readonly filters?: ViewFilterNode
  },
  context: ComputedFieldContext
): string => {
  const { name: countName, relationshipField, filters } = countField
  const { tableAlias, parentTableName, allFields, allTables } = context

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

  const foreignKeyColumn = resolveForeignKeyColumn(
    relationshipFieldDef as unknown as Readonly<Record<string, unknown>>,
    relationshipField,
    parentTableName,
    allTables
  )

  // Build WHERE clause with base condition + optional filter conditions
  const baseCondition = `${alias}.${foreignKeyColumn} = ${tableAlias}.id`

  // Soft-deleted child rows must NOT be counted — a devoted / trashed related
  // record is logically gone (soft-delete-by-default: every app table carries a
  // `deleted_at` column). Without this, un-voting never lowers the count.
  const notDeleted = `${alias}.deleted_at IS NULL`

  // Convert filters to WHERE clauses (flatten nested AND/OR into leaf conditions)
  const filterConditions = filters
    ? flattenFilterNode(filters).map((condition) => buildWhereClause(condition, alias))
    : []

  const whereConditions = [baseCondition, notDeleted, ...filterConditions]
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
 * Build JOIN clauses for forward lookups (many-to-one only, not many-to-many)
 */
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

/**
 * The view's SELECT list: `base.*` plus one expression per computed field.
 *
 * `base.*` always leads so every stored column stays addressable; the computed
 * columns are appended in lookup / rollup / count order.
 */
const buildComputedSelectClause = (table: Table, allTables: readonly Table[]): string => {
  const lookupContext = {
    tableAlias: 'base',
    allFields: table.fields,
    actualTableName: sanitizeTableName(table.name),
    allTables,
  } as const
  const computedContext = {
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

/**
 * Generate CREATE VIEW statement for a table with lookup, rollup, and/or count fields
 * Replaces the base table with a VIEW that includes looked-up, aggregated, and counted columns
 * Returns empty string if table has no lookup, rollup, or count fields
 */
export const generateLookupViewSQL = (table: Table, allTables: readonly Table[] = []): string => {
  const lookupFields = table.fields.filter(isLookupField)
  const rollupFields = table.fields.filter(isRollupField)
  const countFields = table.fields.filter(isCountField)

  if (lookupFields.length === 0 && rollupFields.length === 0 && countFields.length === 0) {
    return '' // No lookup, rollup, or count fields - no VIEW needed
  }

  const sanitized = sanitizeTableName(table.name)

  // Build JOIN clauses for forward lookups
  const joins = buildForwardLookupJoins(lookupFields, table.fields)

  // Computed (lookup/rollup/count) column SELECT list, over the base table.
  const computedSelectClause = buildComputedSelectClause(table, allTables)

  // Dialect-aware view-replacement keyword: PostgreSQL supports
  // `CREATE OR REPLACE VIEW`; SQLite has no `OR REPLACE` (the caller drops the
  // stale view separately), so emit a plain `CREATE VIEW`.
  const createView = isSqliteRuntime() ? 'CREATE VIEW' : 'CREATE OR REPLACE VIEW'

  const fromClause = `FROM ${sanitized}_base AS base
  ${joins ? joins : ''}`

  // Formulas that reference view-only fields (rollup/lookup/count) are computed
  // HERE in the view — never as base-table columns. A formula cannot reference a
  // sibling SELECT alias on Postgres, so the lookup/rollup/count computation is
  // wrapped in a CTE and each formula is layered on top (one CTE layer per
  // formula, in dependency order so formula-over-formula chains resolve).
  const formulaLayers = getViewFormulaLayers(table.fields)

  if (formulaLayers.length === 0) {
    // No view-computed formulas — keep the historical single-SELECT shape.
    return `${createView} ${sanitized} AS
  SELECT
    ${computedSelectClause}
  ${fromClause}`
  }

  return buildLayeredViewSQL({
    createView,
    viewName: sanitized,
    computedSelectClause,
    fromClause,
    formulaLayers,
  })
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
 * Generate INSTEAD OF triggers for a VIEW to make it writable.
 * These triggers redirect INSERT/UPDATE/DELETE operations to the base table.
 *
 * Dialect-aware:
 *
 * - **PostgreSQL** emits `CREATE OR REPLACE FUNCTION … LANGUAGE plpgsql`
 *   wrappers + `CREATE TRIGGER … EXECUTE FUNCTION` — the only way to attach
 *   a body to a PG trigger.
 *
 * - **SQLite** emits plain inline `CREATE TRIGGER … INSTEAD OF … BEGIN …
 *   END;` blocks. No function wrapper, no `OR REPLACE` (preceded by
 *   `DROP TRIGGER IF EXISTS` instead), no `FOR EACH ROW` clause (implicit on
 *   SQLite INSTEAD OF triggers). The trigger body is a plain statement list
 *   that references `NEW.<col>` / `OLD.<col>` exactly the way the PG bodies
 *   do — so the redirect target (`*_base` table + writable column list,
 *   matched on `id`) is identical between the two dialects.
 *
 * Writable column list (`getBaseFields`) already excludes computed (lookup /
 * rollup / count) and one-to-many / many-to-many relationship fields plus
 * `id` — the same exclusions apply on both dialects.
 */
export const generateLookupViewTriggers = (table: Table): readonly string[] => {
  if (!shouldUseView(table)) {
    return [] // No VIEW, no triggers needed
  }

  const sanitized = sanitizeTableName(table.name)
  const baseTableName = getBaseTableName(sanitized)
  const viewName = sanitized
  const baseFields = getBaseFields(table)
  // The UPDATE trigger writes a WIDER list than the INSERT trigger: it must
  // also carry the automatic `deleted_at` column so soft delete / restore
  // through the view are not silently dropped. INSERT deliberately keeps the
  // narrow list — an omitted `deleted_at` takes the base column's own NULL
  // default, so there is nothing for the insert path to carry.
  const updateBaseFields = getUpdateBaseFields(table)
  // [internal ref]: DEFAULT-bearing base columns are emitted as COALESCE(NEW.col,
  // <default>) so an omitted column (e.g. a `created-at` field) takes its base
  // default rather than a NULL that fails a NOT NULL constraint.
  const insertValues = getInsertValueExpressions(table)

  // The INSERT trigger PRESERVES an explicitly-provided `id` (kept out of
  // getBaseFields — the UPDATE/DELETE triggers must never rewrite it — so it is
  // prepended only here). See getInsertIdExpression for the per-dialect,
  // per-primary-key-type semantics.
  const insertFields = ['id', ...baseFields]
  const insertFieldValues = [getInsertIdExpression(table, baseTableName), ...insertValues]

  if (isSqliteRuntime()) {
    return [
      ...generateInsertTriggerSqlite(viewName, baseTableName, insertFields, insertFieldValues),
      ...generateUpdateTriggerSqlite(viewName, baseTableName, updateBaseFields),
      ...generateDeleteTriggerSqlite(viewName, baseTableName),
    ]
  }

  return [
    ...generateInsertTrigger(viewName, baseTableName, insertFields, insertFieldValues),
    ...generateUpdateTrigger(viewName, baseTableName, updateBaseFields),
    ...generateDeleteTrigger(viewName, baseTableName),
  ]
}
