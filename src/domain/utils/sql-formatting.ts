/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const escapeSqlString = (value: string): string => value.replace(/'/g, "''")

export const quoteSqlIdentifier = (identifier: string): string => {
  if (/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    return identifier
  }
  return `"${identifier.replace(/"/g, '""')}"`
}

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
  return `'${escapeSqlString(JSON.stringify(value))}'`
}

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
