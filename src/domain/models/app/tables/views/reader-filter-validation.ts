/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isCurrentUserRef, mentionsCurrentUser } from '@/domain/models/app/pages/current-user-ref'

/** True when one condition value — or one entry of an `in` / `notIn` list — names the reader. */
const valueNamesReader = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(valueNamesReader)
  if (typeof value === 'string') return mentionsCurrentUser(value)
  return isCurrentUserRef(value)
}

/**
 * True when a filter tree compares anything to `$currentUser`, at any depth of
 * its `and` / `or` groups. Anything that is not a filter tree names no reader.
 */
export const filtersNameReader = (filters: unknown): boolean => {
  if (typeof filters !== 'object' || filters === null) return false
  if ('and' in filters && Array.isArray(filters.and)) return filters.and.some(filtersNameReader)
  if ('or' in filters && Array.isArray(filters.or)) return filters.or.some(filtersNameReader)
  return 'value' in filters && valueNamesReader(filters.value)
}

/**
 * The refusal for a field computed once for every reader — a count, a rollup, a
 * lookup — whose `filters` name the reader: there is no reader where it is
 * computed. `undefined` when its filters name none.
 */
export const readerFilterRefusal = (field: {
  readonly name: string
  readonly type: string
  readonly filters?: unknown
}): string | undefined =>
  filtersNameReader(field.filters)
    ? `field "${field.name}": a ${field.type} is computed once and every reader reads the same value, so its filters may not compare to $currentUser. To narrow it to a reader's own records, filter a view on $currentUser instead.`
    : undefined
