/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Escape single quotes in SQL string literals to prevent SQL injection
 * PostgreSQL escapes single quotes by doubling them: ' becomes ''
 *
 * Used across all SQL generators (view-generators, lookup-view-generators, sql-generators)
 */
export const escapeSqlString = (value: string): string => value.replace(/'/g, "''")

/**
 * Format a value for SQL interpolation with proper escaping
 * Strings are escaped and quoted, numbers/booleans are used directly
 */
export const formatSqlValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return `'${escapeSqlString(value)}'`
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value === null) {
    return 'NULL'
  }
  // For other types (objects, arrays), convert to JSON string
  return `'${escapeSqlString(JSON.stringify(value))}'`
}

/**
 * Generate SQL LIKE pattern with wildcards for pattern matching operators
 * Automatically escapes the value to prevent SQL injection
 */
export const formatLikePattern = (
  value: unknown,
  pattern: 'contains' | 'startsWith' | 'endsWith'
): string => {
  const stringValue = typeof value === 'string' ? value : String(value)
  const escaped = escapeSqlString(stringValue)

  switch (pattern) {
    case 'contains':
      return `'%${escaped}%'`
    case 'startsWith':
      return `'${escaped}%'`
    case 'endsWith':
      return `'%${escaped}'`
  }
}
