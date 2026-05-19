/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { formatSqlValue, formatLikePattern, escapeSqlString } from '../sql/sql-utils'

type SqlIdentifier = Readonly<ReturnType<typeof sql.identifier>>

export const SQL_OPERATOR_MAP: Record<string, string> = {
  equals: '=',
  notEquals: '!=',
  greaterThan: '>',
  lessThan: '<',
  greaterThanOrEqual: '>=',
  lessThanOrEqual: '<=',
}

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

const handleNullOperator = (field: string, operator: string): string | undefined => {
  if (operator === 'isNull') {
    return `${field} IS NULL`
  }
  if (operator === 'isNotNull') {
    return `${field} IS NOT NULL`
  }
  if (operator === 'isEmpty') {
    return `(${field} IS NULL OR ${field} = '')`
  }
  return undefined
}

const handleBooleanOperator = (field: string, operator: string): string | undefined => {
  if (operator === 'isTrue') {
    return `${field} = true`
  }
  if (operator === 'isFalse') {
    return `${field} = false`
  }
  return undefined
}

const handleInOperator = (field: string, operator: string, value: unknown): string | undefined => {
  if (operator === 'in') {
    if (!Array.isArray(value)) {
      return undefined
    }
    const formattedValues = value.map((v) => formatSqlValue(v))
    return `${field} IN (${formattedValues.join(', ')})`
  }
  return undefined
}

const formatValue = (value: unknown, useEscapeSqlString: boolean): string => {
  if (useEscapeSqlString && typeof value === 'string') {
    return `'${escapeSqlString(value)}'`
  }
  return formatSqlValue(value)
}

export const generateSqlCondition = (
  field: string,
  operator: string,
  value: unknown,
  options: { readonly useEscapeSqlString?: boolean } = {}
): string => {
  const useEscapeSqlString = options.useEscapeSqlString ?? false

  const patternCondition = handlePatternOperator(field, operator, value)
  if (patternCondition) return patternCondition

  const nullCondition = handleNullOperator(field, operator)
  if (nullCondition) return nullCondition

  const booleanCondition = handleBooleanOperator(field, operator)
  if (booleanCondition) return booleanCondition

  const inCondition = handleInOperator(field, operator, value)
  if (inCondition) return inCondition

  const sqlOperator = SQL_OPERATOR_MAP[operator]
  if (sqlOperator) {
    const formattedValue = formatValue(value, useEscapeSqlString)
    return `${field} ${sqlOperator} ${formattedValue}`
  }

  const formattedValue = formatValue(value, useEscapeSqlString)
  return `${field} = ${formattedValue}`
}


const buildPatternFragment = (
  column: SqlIdentifier,
  operator: string,
  value: unknown
): Readonly<SQL> | undefined => {
  if (operator !== 'contains' && operator !== 'startsWith' && operator !== 'endsWith') {
    return undefined
  }
  const stringValue = typeof value === 'string' ? value : String(value)
  const pattern =
    operator === 'contains'
      ? `%${stringValue}%`
      : operator === 'startsWith'
        ? `${stringValue}%`
        : `%${stringValue}`
  return sql`${column} LIKE ${pattern}`
}

const buildNullFragment = (column: SqlIdentifier, operator: string): Readonly<SQL> | undefined => {
  if (operator === 'isNull') {
    return sql`${column} IS NULL`
  }
  if (operator === 'isNotNull') {
    return sql`${column} IS NOT NULL`
  }
  if (operator === 'isEmpty') {
    return sql`(${column} IS NULL OR ${column} = '')`
  }
  return undefined
}

const buildBooleanFragment = (
  column: SqlIdentifier,
  operator: string
): Readonly<SQL> | undefined => {
  if (operator === 'isTrue') {
    return sql`${column} = true`
  }
  if (operator === 'isFalse') {
    return sql`${column} = false`
  }
  return undefined
}

const buildInFragment = (
  column: SqlIdentifier,
  operator: string,
  value: unknown
): Readonly<SQL> | undefined => {
  if (operator !== 'in') return undefined
  if (!Array.isArray(value)) return undefined
  if (value.length === 0) return sql`${column} IN (NULL)`
  const boundValues = sql.join(
    value.map((v) => sql`${v}`),
    sql`, `
  )
  return sql`${column} IN (${boundValues})`
}

export const generateSqlConditionFragment = (
  field: string,
  operator: string,
  value: unknown
): Readonly<SQL> => {
  const column = sql.identifier(field)

  const patternFragment = buildPatternFragment(column, operator, value)
  if (patternFragment) return patternFragment

  const nullFragment = buildNullFragment(column, operator)
  if (nullFragment) return nullFragment

  const booleanFragment = buildBooleanFragment(column, operator)
  if (booleanFragment) return booleanFragment

  const inFragment = buildInFragment(column, operator, value)
  if (inFragment) return inFragment

  const sqlOperator = SQL_OPERATOR_MAP[operator] ?? '='
  return sql`${column} ${sql.raw(sqlOperator)} ${value}`
}
