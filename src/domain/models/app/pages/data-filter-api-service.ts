/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DataFilter } from './components/data-source'

/**
 * A binding's `dataSource.filter` as the records API's `filter` parameter.
 *
 * The page vocabulary (`eq`, `gte`, …) is not the endpoint's (`equals`,
 * `greaterThanOrEqual`, …), and the endpoint refuses an operator it does not
 * know with a 400 — so every page condition that is sent to it is translated
 * first. Every `FilterOperatorSchema` member has a row, which is what keeps the
 * translation total.
 */
const API_OPERATORS: Readonly<Record<DataFilter['operator'], string>> = {
  eq: 'equals',
  neq: 'notEquals',
  contains: 'contains',
  gt: 'greaterThan',
  lt: 'lessThan',
  gte: 'greaterThanOrEqual',
  lte: 'lessThanOrEqual',
  in: 'in',
  isEmpty: 'isEmpty',
  isNotEmpty: 'isNotEmpty',
}

/**
 * The JSON `filter` parameter (`{"and":[…]}`) for `filters`, or `undefined`
 * when there is nothing to filter by. Values are expected resolved — a
 * `$currentUser` reference is substituted before a page is rendered.
 */
export const toRecordsApiFilterParam = (
  filters: readonly DataFilter[] | undefined
): string | undefined => {
  if (filters === undefined || filters.length === 0) return undefined
  const conditions = filters.map((filter) => ({
    field: filter.field,
    operator: API_OPERATORS[filter.operator],
    ...(filter.value !== undefined ? { value: filter.value } : {}),
  }))
  return JSON.stringify({ and: conditions })
}
