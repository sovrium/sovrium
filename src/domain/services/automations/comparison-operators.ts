/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The comparison-operator table behind every `ConditionGroup` in the product.
 *
 * One table, one set of semantics. Record triggers (`record-trigger-filters`),
 * `filter/continue` and `path/branch` all evaluate the SAME schema type — an
 * author reasonably expects `notEquals` and `greaterThan` to mean the same
 * thing wherever they write them — and a second copy is how they come to
 * disagree.
 *
 * It lives in the domain layer because it is exactly what the domain layer is
 * for: pure functions over plain values, no I/O, no Effect, no template engine,
 * no knowledge of automations-the-runtime. The application-layer callers add
 * the impure parts around it — resolving a `field` against a record, or
 * substituting a `{{...}}` template — and those stay where they are.
 *
 * Covers all 15 operators in `ComparisonOperatorSchema`
 * (`src/domain/models/app/automations/conditions.ts`); the table is the reason
 * callers stay trivial, and coverage is extended by adding an entry here rather
 * than by growing a switch in each caller.
 */

/** Canonical string form used for equality, substring and regex comparisons. */
const formatComparable = (value: unknown): string => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
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
 * fails closed — the condition does not match on broken regexes rather than
 * blowing up the request that produced the event.
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
 * Map of supported comparison operators to (lhs, expected) → boolean.
 *
 * Ordered comparisons (greaterThan/lessThan/...) coerce by type via
 * `compareOrdered`: numbers compare numerically, Date-looking strings compare
 * chronologically, anything else falls back to lexicographic string compare.
 *
 * NOTE the fail-OPEN asymmetry of `isEmpty` / `isNull`: they answer on the
 * VALUE alone, so a condition naming a field that does not exist reads
 * `undefined` and returns true. That is correct for an absent value and wrong
 * for an absent FIELD, but the two are indistinguishable here — a value-level
 * table cannot see a schema. Callers that can tell the difference are the ones
 * that must refuse an unknown field name.
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
