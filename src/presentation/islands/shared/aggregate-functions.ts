/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type AggregateFunction = 'count' | 'sum' | 'avg' | 'min' | 'max'

export function reduceAggregate(fn: AggregateFunction, values: readonly number[]): number {
  if (fn === 'count') return values.length
  if (values.length === 0) return 0
  if (fn === 'sum') return values.reduce((a, b) => a + b, 0)
  if (fn === 'avg') return values.reduce((a, b) => a + b, 0) / values.length
  if (fn === 'min') return values.reduce((a, b) => (b < a ? b : a))
  return values.reduce((a, b) => (b > a ? b : a))
}
