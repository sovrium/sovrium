/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  distinctArrayAggExpression,
  emptyArrayLiteral,
  nonEmptyValuePredicate,
} from '../sql/dialect-ddl'
import { generateSqlCondition } from '../table-queries/filter-operators'
import type { ViewFilterCondition, ViewFilterNode } from '@/domain/models/app/tables/views/filters'

/**
 * Extract leaf conditions from a ViewFilterNode tree.
 * Flattens nested AND/OR groups into a flat array of conditions (treated as AND).
 * This is a bridge until full recursive SQL generation is implemented.
 */
export const flattenFilterNode = (node: ViewFilterNode): readonly ViewFilterCondition[] => {
  if ('and' in node) {
    return node.and.flatMap(flattenFilterNode)
  }
  if ('or' in node) {
    return node.or.flatMap(flattenFilterNode)
  }
  return [node]
}

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
  const column = `${aliasPrefix}.${field}`
  return generateSqlCondition(column, operator, value, { useEscapeSqlString: true })
}

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
