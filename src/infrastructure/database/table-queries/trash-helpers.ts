/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

/**
 * Build filter conditions for trash list query
 */
export function buildTrashFilters(
  baseQuery: Readonly<SQL>,
  filters?: readonly {
    readonly field: string
    readonly operator: string
    readonly value: unknown
  }[]
): Readonly<SQL> {
  return (filters ?? []).reduce((query, condition) => {
    const { field, operator, value } = condition
    const fieldIdentifier = sql.identifier(field)

    switch (operator) {
      case 'equals':
        return sql`${query} AND ${fieldIdentifier} = ${value}`
      case 'notEquals':
        return sql`${query} AND ${fieldIdentifier} != ${value}`
      case 'contains':
        return sql`${query} AND ${fieldIdentifier} ILIKE ${'%' + String(value) + '%'}`
      case 'greaterThan':
        return sql`${query} AND ${fieldIdentifier} > ${value}`
      case 'lessThan':
        return sql`${query} AND ${fieldIdentifier} < ${value}`
      case 'greaterThanOrEqual':
        return sql`${query} AND ${fieldIdentifier} >= ${value}`
      case 'lessThanOrEqual':
        return sql`${query} AND ${fieldIdentifier} <= ${value}`
      default:
        return query
    }
  }, baseQuery)
}

/**
 * Add sorting to trash list query
 */
export function addTrashSorting(query: Readonly<SQL>, sort?: string): Readonly<SQL> {
  if (!sort) return query

  const [field, order] = sort.split(':')
  if (!field) return query

  const direction = order?.toLowerCase() === 'desc' ? sql`DESC` : sql`ASC`
  return sql`${query} ORDER BY ${sql.identifier(field)} ${direction}`
}
