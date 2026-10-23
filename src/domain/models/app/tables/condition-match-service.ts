/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The evaluators of the shared condition vocabulary (`condition-operators.ts`):
 * a `cellStyle[].when`, a `visibleWhen`, a chart's `barColor` rule.
 *
 * Kept free of any `effect` import: the islands that match a record in the
 * browser import these, and whatever this module imports ships with them.
 */

import { isEmptyCell } from '@/domain/kernel/matching/empty-value'
import { fieldLiteralOf } from './checkbox-literal-service'
import type { FieldCondition } from './condition-operators'

/**
 * Apply one operator to a value.
 *
 * Comparison is string-based for the equality/membership/containment family
 * and numeric for the ordering family, so a `status` column holding `'3'`
 * satisfies both `eq: '3'` and `gt: 2`. An unknown operator matches nothing
 * rather than throwing — the schema already constrains the vocabulary, and a
 * value arriving from a rehydrated JSON blob must not crash a render.
 */
const matchesCondition = (operator: string, given: unknown, value: unknown): boolean => {
  // A boolean value is a checkbox read through its type: the literal it is
  // compared with is read the same way, so `eq: 1` matches a ticked row.
  const expected = typeof value === 'boolean' ? fieldLiteralOf('checkbox', given) : given
  const strValue = String(value)
  const numValue = Number(value)
  const matchers: Readonly<Record<string, () => boolean>> = {
    isEmpty: () => expected === true && isEmptyCell(value),
    isNotEmpty: () => expected === true && !isEmptyCell(value),
    eq: () => strValue === String(expected),
    neq: () => strValue !== String(expected),
    in: () => Array.isArray(expected) && expected.some((entry) => String(entry) === strValue),
    notIn: () => Array.isArray(expected) && !expected.some((entry) => String(entry) === strValue),
    contains: () => strValue.includes(String(expected)),
    gt: () => !Number.isNaN(numValue) && numValue > Number(expected),
    lt: () => !Number.isNaN(numValue) && numValue < Number(expected),
    gte: () => !Number.isNaN(numValue) && numValue >= Number(expected),
    lte: () => !Number.isNaN(numValue) && numValue <= Number(expected),
  }
  return matchers[operator]?.() ?? false
}

/**
 * Evaluate a condition-operators object against a single value. Every supplied
 * operator must match (logical AND); `undefined` operators are skipped, so an
 * empty object matches everything.
 */
export const matchesConditionOperators = (
  operators: Readonly<Record<string, unknown>>,
  value: unknown
): boolean => {
  return Object.entries(operators)
    .filter(([, expected]) => expected !== undefined)
    .every(([operator, expected]) => matchesCondition(operator, expected, value))
}

/**
 * Evaluate a field condition (`FieldConditionSchema`) against one record.
 *
 * An absent predicate means "always visible" — the backward-compatible default
 * every consumer relies on, so callers can pass `undefined` straight through
 * rather than branching at each site.
 */
export const satisfiesFieldCondition = (
  condition: Readonly<FieldCondition> | undefined,
  record: Readonly<Record<string, unknown>>
): boolean => {
  if (!condition) return true
  const { field, ...operators } = condition
  return matchesConditionOperators(operators, record[field])
}
