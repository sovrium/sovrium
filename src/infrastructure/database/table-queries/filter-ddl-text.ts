/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { LIKE_ESCAPE_CLAUSE } from '@/domain/kernel/sql/sql-formatting'
import { formatSqlValue, formatLikePattern, escapeSqlString } from '../sql/sql-utils'
import { betweenSqlCondition } from './between-condition'
import { isSetOperator, setMembersOf, SQL_OPERATOR_MAP } from './filter-operators'
import { notContainsSqlCondition } from './not-contains-condition'
import { serverOperatorDdlCondition } from './server-operator-fragment'
import { unknownOperator } from './unknown-operator'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/**
 * The filter compiler that writes SQL TEXT, for the DDL generators (view and
 * lookup definitions) where bound parameters are illegal. Values are inlined
 * through the escaping helpers; column names arrive already validated.
 *
 * Its runtime sibling, `generateSqlConditionFragment` in `filter-operators.ts`,
 * binds every value instead. The two share the operator table and the
 * set-membership rules, so a filter selects the same rows either way.
 */

/**
 * Handle LIKE pattern operators (contains, startsWith, endsWith, notContains)
 *
 * Case-folded on BOTH sides — see the DECISION note in `filter-operators.ts`. A
 * bare `LIKE` here is not a neutral choice: it is case-SENSITIVE on PostgreSQL
 * and case-INSENSITIVE on SQLite, so the same view definition selects different
 * rows on the two engines.
 *
 * The column is cast to text before it is folded, as the bound runtime twin
 * (`buildPatternFragment` in `filter-operators.ts`) does: PostgreSQL has no `lower()` for a date,
 * a number or a boolean, so a view filtering one of those columns failed to
 * be created. SQLite reads the cast as a no-op on text.
 */
const handlePatternOperator = (
  field: string,
  operator: string,
  value: unknown
): string | undefined => {
  if (operator === 'contains' || operator === 'startsWith' || operator === 'endsWith') {
    return `LOWER(CAST(${field} AS TEXT)) LIKE LOWER(${formatLikePattern(value, operator)}) ${LIKE_ESCAPE_CLAUSE}`
  }
  return notContainsSqlCondition(field, operator, value)
}

/**
 * The texts an empty value reads as once cast to text — the inline twin of
 * `EMPTY_VALUE_TEXTS` below, for DDL where nothing can be bound. Constant
 * literals: no configured value reaches this string.
 */
const EMPTY_VALUE_TEXTS_LITERAL = "('', '[]', '{}')"

/**
 * Handle NULL check operators (isNull, isNotNull, isEmpty, isNotEmpty)
 *
 * `isEmpty` / `isNotEmpty` compile to exactly the condition the parameterised
 * `emptyValueCondition` (`filter-operators.ts`) emits: NULL, or the column cast to
 * text reads `''`, `'[]'` or `'{}'`. Comparing as TEXT is what lets one
 * condition read a PostgreSQL array (an empty `TEXT[]` casts to `{}`), a JSON
 * column and plain text on both engines — a bare `= ''` against an array
 * column is a `malformed array literal` on PostgreSQL.
 */
const handleNullOperator = (field: string, operator: string): string | undefined => {
  if (operator === 'isNull') {
    return `${field} IS NULL`
  }
  if (operator === 'isNotNull') {
    return `${field} IS NOT NULL`
  }
  if (operator === 'isEmpty') {
    return `(${field} IS NULL OR CAST(${field} AS TEXT) IN ${EMPTY_VALUE_TEXTS_LITERAL})`
  }
  if (operator === 'isNotEmpty') {
    return `(${field} IS NOT NULL AND CAST(${field} AS TEXT) NOT IN ${EMPTY_VALUE_TEXTS_LITERAL})`
  }
  return undefined
}

/** Handle boolean operators (isTrue, isFalse) */
const handleBooleanOperator = (field: string, operator: string): string | undefined => {
  if (operator === 'isTrue') {
    return `${field} = true`
  }
  if (operator === 'isFalse') {
    return `${field} = false`
  }
  return undefined
}

/**
 * Handle the set-membership operators `in` and `notIn`.
 *
 * A row with no value is kept by neither: `in` cannot match NULL, and `notIn`
 * states `IS NOT NULL` rather than leaving it to `NOT IN`'s three-valued logic,
 * so the rule reads the same on both engines. An empty `notIn` list leaves out
 * nothing that has a value — where SQL's `NOT IN (NULL)` would leave out every
 * row. See {@link setMembersOf} for a single value and a null member.
 */
const handleInOperator = (field: string, operator: string, value: unknown): string | undefined => {
  if (!isSetOperator(operator)) return undefined
  const formattedValues = setMembersOf(operator, value).map((v) => formatSqlValue(v))
  if (operator === 'in') {
    return formattedValues.length === 0 ? '1 = 0' : `${field} IN (${formattedValues.join(', ')})`
  }
  return formattedValues.length === 0
    ? `${field} IS NOT NULL`
    : `(${field} IS NOT NULL AND ${field} NOT IN (${formattedValues.join(', ')}))`
}

/** Format value based on options */
const formatValue = (value: unknown, useEscapeSqlString: boolean): string => {
  if (useEscapeSqlString && typeof value === 'string') {
    return `'${escapeSqlString(value)}'`
  }
  return formatSqlValue(value)
}

/**
 * Generate SQL condition from filter operator and value
 * Handles both simple operators (equals, greaterThan, etc.) and pattern matching (contains, startsWith, etc.)
 *
 * @param field - Column name or expression
 * @param operator - Filter operator (equals, greaterThan, contains, etc.)
 * @param value - Filter value
 * @param options - Optional configuration
 * @param options.useEscapeSqlString - Use escapeSqlString instead of formatSqlValue for string values (for manual string formatting)
 * @returns SQL condition string
 */
export const generateSqlCondition = (
  field: string,
  operator: string,
  value: unknown,
  options: { readonly dialect: DatabaseDialect; readonly useEscapeSqlString?: boolean }
): string => {
  const useEscapeSqlString = options.useEscapeSqlString ?? false

  const serverCondition = serverOperatorDdlCondition(options.dialect, field, operator, value)
  if (serverCondition) return serverCondition

  const patternCondition = handlePatternOperator(field, operator, value)
  if (patternCondition) return patternCondition

  const nullCondition = handleNullOperator(field, operator)
  if (nullCondition) return nullCondition

  const booleanCondition = handleBooleanOperator(field, operator)
  if (booleanCondition) return booleanCondition

  const inCondition = handleInOperator(field, operator, value)
  if (inCondition) return inCondition

  const between = betweenSqlCondition(field, operator, value, (bound) =>
    formatValue(bound, useEscapeSqlString)
  )
  if (between) return between

  const sqlOperator = SQL_OPERATOR_MAP[operator]
  if (sqlOperator) {
    const formattedValue = formatValue(value, useEscapeSqlString)
    return `${field} ${sqlOperator} ${formattedValue}`
  }

  return unknownOperator(operator)
}
