/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Parse a `sort` query parameter of the record-scoped lists that order by
 * time alone — a record's comments and its history: `createdAt:asc` or
 * `createdAt:desc`. Anything else answers `undefined`, which keeps each list's
 * own default order (oldest first).
 */
export function parseCreatedAtSortOrder(sortParam: string | undefined): 'asc' | 'desc' | undefined {
  if (!sortParam) {
    return undefined
  }

  const [field, order] = sortParam.split(':')
  if (field === 'createdAt' && (order === 'asc' || order === 'desc')) {
    return order
  }

  return undefined
}
