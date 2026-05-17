/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTriggerInString } from './resolve-trigger-data'
import type { ConditionGroup } from '@/domain/models/app/automations/conditions'

/**
 * Trigger-time condition evaluation for record triggers.
 *
 * Implements the full ConditionGroup operator set defined in
 * `src/domain/models/app/automations/conditions.ts` so any schema-valid
 * condition fires consistently at record-trigger evaluation time. Operator
 * coverage was widened from the original T-3 canary subset (8 ops) to all
 * 15 operators after the auditor's T-3 R-3 finding flagged silent
 * "schema-valid but never fires" drift on the missing comparators.
 *
 * Condition `field` may be either a literal column name or a template
 * variable. Two template shapes are supported, matching the spec authoring
 * conventions in `record.spec.ts`:
 *   - `{{record.<field>}}`            ← preferred (record-trigger context)
 *   - `{{trigger.data.record.<field>}}` ← canonical engine context
 */

const formatComparable = (value: unknown): string => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

/**
 * Resolve a condition's `field` against the record context. A template
 * variable (`{{record.X}}`) substitutes the record value; a literal name
 * is read as a column lookup — same semantic as the action-handler filter
 * in `record.ts`'s `extractIdFromFilter`.
 */
const resolveLhs = (field: string, record: Record<string, unknown>): unknown => {
  const ctx = { record, trigger: { data: { record } } }
  const resolved = resolveTriggerInString(field, ctx)
  return resolved === field ? record[field] : resolved
}

const isDefined = (v: unknown): boolean => v !== undefined && v !== null
const isDateInput = (v: unknown): boolean => v instanceof Date || typeof v === 'string'

/**
 * Compare two date-like inputs by their epoch-ms representation. Returns
 * `undefined` when either side fails to parse — caller falls back to
 * lexicographic compare.
 */
const compareDates = (lhs: unknown, expected: unknown): number | undefined => {
  const lhsTime = new Date(lhs as string | Date).getTime()
  const expectedTime = new Date(expected as string | Date).getTime()
  if (Number.isNaN(lhsTime) || Number.isNaN(expectedTime)) return undefined
  return lhsTime - expectedTime
}

/**
 * Lexicographic string compare on the canonical comparable representation.
 */
const compareStrings = (lhs: unknown, expected: unknown): number => {
  const lhsStr = formatComparable(lhs)
  const expectedStr = formatComparable(expected)
  if (lhsStr < expectedStr) return -1
  if (lhsStr > expectedStr) return 1
  return 0
}

/**
 * Type-coerced ordered comparison for greaterThan / lessThan / etc.
 *
 * Resolution order:
 *   1. Both numeric → numeric compare.
 *   2. Both parse to a valid Date (and at least one source side was a
 *      string or Date — never coerce raw numbers to Dates) → date compare.
 *   3. Otherwise → lexicographic string compare via `formatComparable`.
 *
 * Returns `undefined` only when one side is null/undefined (callers fail
 * closed for ordered comparisons against missing values).
 */
const compareOrdered = (lhs: unknown, expected: unknown): number | undefined => {
  if (!isDefined(lhs) || !isDefined(expected)) return undefined
  if (typeof lhs === 'number' && typeof expected === 'number') return lhs - expected
  if (isDateInput(lhs) && isDateInput(expected)) {
    const dateCmp = compareDates(lhs, expected)
    if (dateCmp !== undefined) return dateCmp
  }
  return compareStrings(lhs, expected)
}

/**
 * Compile a regex from the user-provided pattern. Failure (invalid syntax)
 * fails closed — the trigger does not fire on broken regexes rather than
 * blowing up the request that produced the record event.
 */
const tryRegexTest = (lhs: unknown, pattern: unknown): boolean => {
  if (typeof pattern !== 'string') return false
  try {
    return new RegExp(pattern).test(formatComparable(lhs))
  } catch {
    return false
  }
}

/**
 * Map of supported comparison operators to (lhs, expected) → boolean. Kept
 * as a table so `evaluateOne` stays trivial and operator coverage is
 * extended by adding entries here rather than growing a switch.
 *
 * Covers all 15 operators in `ComparisonOperatorSchema`. Ordered comparisons
 * (greaterThan/lessThan/...) coerce by type via `compareOrdered`: numbers
 * compare numerically, Date-looking strings compare chronologically, anything
 * else falls back to lexicographic string compare.
 */
export const COMPARATORS: Readonly<Record<string, (lhs: unknown, expected: unknown) => boolean>> = {
  equals: (lhs, expected) => formatComparable(lhs) === formatComparable(expected),
  notEquals: (lhs, expected) => formatComparable(lhs) !== formatComparable(expected),
  contains: (lhs, expected) => formatComparable(lhs).includes(formatComparable(expected)),
  notContains: (lhs, expected) => !formatComparable(lhs).includes(formatComparable(expected)),
  startsWith: (lhs, expected) => formatComparable(lhs).startsWith(formatComparable(expected)),
  endsWith: (lhs, expected) => formatComparable(lhs).endsWith(formatComparable(expected)),
  greaterThan: (lhs, expected) => {
    const cmp = compareOrdered(lhs, expected)
    return cmp !== undefined && cmp > 0
  },
  greaterThanOrEqual: (lhs, expected) => {
    const cmp = compareOrdered(lhs, expected)
    return cmp !== undefined && cmp >= 0
  },
  lessThan: (lhs, expected) => {
    const cmp = compareOrdered(lhs, expected)
    return cmp !== undefined && cmp < 0
  },
  lessThanOrEqual: (lhs, expected) => {
    const cmp = compareOrdered(lhs, expected)
    return cmp !== undefined && cmp <= 0
  },
  isEmpty: (lhs) => lhs === undefined || lhs === null || lhs === '',
  isNotEmpty: (lhs) => lhs !== undefined && lhs !== null && lhs !== '',
  isNull: (lhs) => lhs === null || lhs === undefined,
  isNotNull: (lhs) => lhs !== null && lhs !== undefined,
  matches: tryRegexTest,
}

const evaluateOne = (
  field: string,
  operator: string,
  expected: unknown,
  record: Record<string, unknown>
): boolean => {
  const compare = COMPARATORS[operator]
  // Unknown operator: fail closed. A future migration spec can extend
  // operator coverage; until then, an unrecognised operator should NOT
  // silently become "true" — that would over-fire the trigger.
  if (compare === undefined) return false
  return compare(resolveLhs(field, record), expected)
}

/**
 * Evaluate a ConditionGroup against the given record.
 *
 * Logic defaults to `and` (all conditions must match), matching the schema's
 * documented default. `or` short-circuits on the first match.
 */
export const evaluateRecordTriggerCondition = (
  group: ConditionGroup,
  record: Record<string, unknown>
): boolean => {
  const logic = group.logic ?? 'and'
  if (logic === 'or') {
    return group.conditions.some((c) => evaluateOne(c.field, c.operator, c.value, record))
  }
  return group.conditions.every((c) => evaluateOne(c.field, c.operator, c.value, record))
}
