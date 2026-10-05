/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { buildUserFilterConditions, type FilterNode } from './aggregation-helpers'
import type { SQL } from 'drizzle-orm'

/**
 * Build filter conditions for trash list query.
 *
 * The trash takes the live listing's `filter` and answers the same rows: each
 * condition is compiled by the live listing's own compiler
 * ({@link buildUserFilterConditions}), so every operator the live listing
 * applies — `in`, `startsWith`, `isEmpty`, `isTrue` and the rest — narrows the
 * trash too, never silently skipped.
 */
export function buildTrashFilters(
  baseQuery: Readonly<SQL>,
  filters?: readonly FilterNode[]
): Readonly<SQL> {
  return buildUserFilterConditions({ and: filters ?? [] }).reduce(
    (query, condition) => sql`${query} AND ${condition}`,
    baseQuery
  )
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
