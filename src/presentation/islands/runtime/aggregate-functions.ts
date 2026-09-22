/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared numeric aggregate functions for data-bound islands.
 *
 * Both the chart aggregate (`chart-aggregate.ts`) and the KPI metric
 * (`kpi-compute.ts`) reduce a group of numeric values down to a single
 * number via the same `count | sum | avg | min | max` set. This module is
 * the single source of truth for that reducer so the two stay in lock-step.
 */

/** The set of numeric aggregate functions a data island can apply. */
export type AggregateFunction = 'count' | 'sum' | 'avg' | 'min' | 'max'

/**
 * Reduces a group of numeric values down to the aggregate result.
 *
 * `count` returns the number of values; every other function operates on the
 * values themselves and returns `0` for an empty group.
 */
export function reduceAggregate(fn: AggregateFunction, values: readonly number[]): number {
  if (fn === 'count') return values.length
  if (values.length === 0) return 0
  if (fn === 'sum') return values.reduce((a, b) => a + b, 0)
  if (fn === 'avg') return values.reduce((a, b) => a + b, 0) / values.length
  if (fn === 'min') return values.reduce((a, b) => (b < a ? b : a))
  return values.reduce((a, b) => (b > a ? b : a))
}
