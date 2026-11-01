/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The order a graph column or lane spine is drawn in, by its declared sortBy
 * and sortDirection.
 */

import type { GraphRecord } from './graph-view'

const compareValues = (left: unknown, right: unknown): number =>
  typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right))

/**
 * Order a column's nodes — or the lane SPINE — by `sortBy`, in `sortDirection`.
 *
 * One function for both, because the two declarations ask the same question in
 * the same words. Its parameter is therefore the PAIR OF KEYS rather than a
 * `GraphColumn`: a lanes declaration is not a column and must not have to
 * pretend to be one in order to be sorted. Stations are deliberately not
 * sortable and never reach here — their order is the chain the edges describe.
 *
 * A node that does not CARRY the field keeps its source order AFTER those that
 * do — the schema's own wording. On the console's own instance that is what
 * puts the open rung last in Grant sources: it ranks on no ladder, so it can
 * neither sort among the levelled roles nor be dropped.
 */
interface SortSpec {
  readonly sortBy?: string
  readonly sortDirection?: string
}

export const order = (nodes: readonly GraphRecord[], spec: SortSpec): readonly GraphRecord[] => {
  const key = spec.sortBy
  if (key === undefined) return nodes
  const direction = spec.sortDirection === 'desc' ? -1 : 1
  const carried = nodes.filter((node) => node[key] !== undefined && node[key] !== null)
  const uncarried = nodes.filter((node) => node[key] === undefined || node[key] === null)
  return [
    ...carried.toSorted((left, right) => direction * compareValues(left[key], right[key])),
    ...uncarried,
  ]
}
