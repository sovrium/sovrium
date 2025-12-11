/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatSqlValue, formatLikePattern, escapeSqlString } from './sql-utils'

/**
 * SQL operator mapping for comparison operators
 * Maps domain filter operators to SQL comparison operators
 */
export const SQL_OPERATOR_MAP: Record<string, string> = {
  equals: '=',
  notEquals: '!=',
  greaterThan: '>',
  lessThan: '<',
  greaterThanOrEqual: '>=',
  lessThanOrEqual: '<=',
}

/**
 * Handle LIKE pattern operators (contains, startsWith, endsWith)
 */
const handlePatternOperator = (
  field: string,
  operator: string,
  value: unknown
): string | undefined => {
  if (operator === 'contains' || operator === 'startsWith' || operator === 'endsWith') {
    return `${field} LIKE ${formatLikePattern(value, operator)}`
  }
  return undefined
}

/**
 * Handle NULL check operators (isNull, isNotNull)
 */
const handleNullOperator = (field: string, operator: string): string | undefined => {
  if (operator === 'isNull') {
    return `${field} IS NULL`
  }
  if (operator === 'isNotNull') {
    return `${field} IS NOT NULL`
  }
  return undefined
}

/**
 * Format value based on options
 */
const formatValue = (
  value: unknown,
  useEscapeSqlString: boolean
): string => {
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
  options: { readonly useEscapeSqlString?: boolean } = {}
): string => {
  const useEscapeSqlString = options.useEscapeSqlString ?? false

  // Handle LIKE pattern operators
  const patternCondition = handlePatternOperator(field, operator, value)
  if (patternCondition) return patternCondition

  // Handle NULL operators
  const nullCondition = handleNullOperator(field, operator)
  if (nullCondition) return nullCondition

  // Handle comparison operators
  const sqlOperator = SQL_OPERATOR_MAP[operator]
  if (sqlOperator) {
    const formattedValue = formatValue(value, useEscapeSqlString)
    return `${field} ${sqlOperator} ${formattedValue}`
  }

  // Fallback to equals if operator not recognized
  const formattedValue = formatValue(value, useEscapeSqlString)
  return `${field} = ${formattedValue}`
}
