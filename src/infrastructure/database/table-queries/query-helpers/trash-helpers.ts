/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import type { FilterNode, FilterLeaf } from './aggregation-helpers'
import type { SQL } from 'drizzle-orm'

const isLeafFilter = (node: FilterNode): node is FilterLeaf => 'field' in node && 'operator' in node

export function buildTrashFilters(
  baseQuery: Readonly<SQL>,
  filters?: readonly FilterNode[]
): Readonly<SQL> {
  return (filters ?? []).filter(isLeafFilter).reduce((query, condition) => {
    const { field, operator, value } = condition
    const fieldIdentifier = sql.identifier(field)

    switch (operator) {
      case 'equals':
        return sql`${query} AND ${fieldIdentifier} = ${value}`
      case 'notEquals':
        return sql`${query} AND ${fieldIdentifier} != ${value}`
      case 'contains':
        return sql`${query} AND LOWER(${fieldIdentifier}) LIKE LOWER(${'%' + String(value) + '%'})`
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

export function addTrashSorting(query: Readonly<SQL>, sort?: string): Readonly<SQL> {
  if (!sort) return query

  const [field, order] = sort.split(':')
  if (!field) return query

  const direction = order?.toLowerCase() === 'desc' ? sql`DESC` : sql`ASC`
  return sql`${query} ORDER BY ${sql.identifier(field)} ${direction}`
}
