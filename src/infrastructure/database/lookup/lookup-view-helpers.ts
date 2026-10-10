/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  distinctArrayAggExpression,
  emptyArrayLiteral,
  nonEmptyValuePredicate,
} from '../sql/dialect-ddl'
import { generateSqlCondition } from '../table-queries/filter-operators'
import { compileFilterTree } from '../table-queries/filter-tree'
import type { ViewFilterCondition, ViewFilterNode } from '@/domain/models/app/tables/views/filters'

/**
 * A table as a view body names it: its derived database name (the config name
 * in lowercase with underscores), quoted as an identifier. The CONFIG name may
 * hold a hyphen or a space — `client-accounts`, `Open Tasks` — and spliced
 * as it is, it broke the statement or, worse, rewrote it (`Cl --` comments out
 * the rest of the line).
 */
export const relationNameOf = (table: string): string =>
  quoteSqlIdentifier(sanitizeTableName(table))

/** The alias a computed field reads a related table under, built from the derived name. */
export const relatedAliasOf = (relatedTable: string, fieldName: string): string =>
  quoteSqlIdentifier(`${sanitizeTableName(relatedTable)}_for_${fieldName}`)

/**
 * Build a WHERE clause fragment from a view filter condition.
 *
 * Emits inline escaped literals rather than bound parameters. That is the
 * correct mode here, and the only available one: both callers
 * (`lookup-view-generators.ts` and `lookup-expressions.ts`) splice the result
 * into `CREATE VIEW` / `CREATE OR REPLACE VIEW` text, and DDL cannot carry
 * parameter placeholders — a view definition is stored, not executed once.
 *
 * The values are equally not user input: a `ViewFilterCondition` comes from
 * the application's own declared configuration, decoded by AppSchema at boot,
 * so it is authored alongside the rest of the app rather than supplied by a
 * request.
 *
 * Runtime queries take the opposite route: they must use bound parameters, so
 * they call `generateSqlConditionFragment` instead of this function.
 */
export const buildWhereClause = (filter: ViewFilterCondition, aliasPrefix: string): string => {
  const { field, operator, value } = filter
  const column = `${aliasPrefix}.${quoteSqlIdentifier(field)}`
  return generateSqlCondition(column, operator, value, { useEscapeSqlString: true })
}

/**
 * Compile the `filters` of a `rollup`, `count` or `lookup` field into one
 * WHERE fragment over the related rows read under `alias`, through the walker
 * a table view uses ({@link compileFilterTree}).
 *
 * `filters` is a single condition or an `and` / `or` group nested as deep as
 * needed, exactly as a view's filter is. A group joins its children with
 * `AND` / `OR`, each child parenthesised so a nested group keeps its own
 * meaning; a group of one is that one; an empty group restricts nothing and
 * compiles to `undefined`, which the caller leaves out of its WHERE list.
 *
 * Leaves go through {@link buildWhereClause}, so value-less operators
 * (`isEmpty`, `isNotEmpty`) compile like any other and values stay inline
 * escaped literals, the only form a view definition can store.
 */
export const compileRelationalFilter = (node: ViewFilterNode, alias: string): string | undefined =>
  compileFilterTree(node, (condition) => buildWhereClause(condition, alias), { wrapGroups: true })

/**
 * Map a rollup `aggregation` term to the SQL that computes it, on the ACTIVE
 * dialect.
 *
 * RENAMED from `mapAggregationToPostgres`, and the old name was a lie with
 * consequences. This function has always served BOTH engines, but "ToPostgres"
 * made it read as a Postgres-only helper that something else must be mirroring
 * for SQLite. Nothing was. Seven of its eight branches happen to be portable
 * ANSI SQL and so the misnomer cost nothing; `ARRAYUNIQUE` was not portable,
 * and a config declaring it validated clean and then aborted schema init on the
 * ZERO-CONFIG DEFAULT engine with `SQLiteError: near "[]": syntax error`.
 *
 * The one non-portable branch now delegates to `sql/dialect-ddl`, where every
 * other per-dialect expression in this codebase already lives, rather than
 * growing a second dialect switch here.
 */
export const mapAggregationToSql = (aggregation: string, relatedField: string): string => {
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
      return `COUNT(CASE WHEN ${nonEmptyValuePredicate(relatedField)} THEN 1 END)`
    case 'COUNTALL':
      return `COUNT(*)`
    case 'ARRAYUNIQUE':
      return distinctArrayAggExpression(relatedField)
    default:
      return `SUM(${relatedField})`
  }
}

/**
 * Generate default value for empty aggregation results.
 *
 * Dialect-aware for `ARRAYUNIQUE` only — the other branches are literals both
 * engines read the same way.
 */
export const getDefaultValueForAggregation = (aggregation: string): string => {
  const upperAgg = aggregation.toUpperCase()

  switch (upperAgg) {
    case 'AVG':
    case 'MIN':
    case 'MAX':
      return 'NULL'
    case 'ARRAYUNIQUE':
      return emptyArrayLiteral()
    default:
      return '0'
  }
}
