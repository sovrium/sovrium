/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure server-side evaluator for the `VisibleWhenCondition` shape.
 *
 * Used by:
 *   - `application/use-cases/forms/submit-form.ts` to drop hidden-field
 *     values from the submitted payload (APP-FORMS-026, -035) and to flip
 *     `requiredWhen` rules into hard required-field rejections (APP-FORMS-029).
 *   - `application/use-cases/forms/submit-form.ts` to skip required-field
 *     enforcement on conditionally-hidden fields (APP-FORMS-031).
 *
 * Mirrors the client-side `evaluateCondition` in
 * `presentation/islands/components/crud-form/conditions.ts` so the runtime
 * and the server agree on visibility for every operator. The client variant
 * still handles the smaller `eq | neq | contains | empty | notEmpty` set
 * because the inline crud-form was authored before the operator catalog
 * grew; once that gap is felt by a spec we promote the same evaluator into
 * a shared module.
 *
 * Operator catalog (`docs/user-stories/as-developer/forms/conditional-logic.md`):
 *   - `eq` / `neq`           — strict equality
 *   - `contains`             — substring (string) or membership (array)
 *   - `empty` / `notEmpty`   — absent (`null`/`undefined`/`""`/`[]`)
 *   - `gt` / `gte` / `lt` / `lte` — numeric or date comparison
 *   - `in` / `notIn`         — value matches one of an array
 */

import type { VisibleWhen, VisibleWhenCondition } from './visible-when'

/**
 * Loose value type for evaluation. `undefined` and `null` mark the field as
 * absent; everything else is compared per-operator. Arrays are tolerated for
 * `contains` (membership) and `empty`/`notEmpty` (length-based).
 */
export type FieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<string | number | boolean>

const isAbsent = (value: FieldValue): boolean => {
  if (value === undefined || value === null) return true
  if (typeof value === 'string' && value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

/**
 * Coerce a value into a number for ordered comparison. Returns `undefined`
 * when the coercion fails so the caller can short-circuit to `false`. Date
 * strings (ISO-8601) parse via `Date.parse`; raw numbers pass through; raw
 * numeric strings (e.g. `"42"`) parse via `Number`.
 */
const toComparableNumber = (value: FieldValue): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value !== '') {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
    const dateNum = Date.parse(value)
    if (Number.isFinite(dateNum)) return dateNum
  }
  return undefined
}

const toScalarString = (value: FieldValue): string => {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.map((v) => String(v)).join(',')
  return String(value)
}

const evaluateContains = (fieldValue: FieldValue, expected: VisibleWhen['value']): boolean => {
  if (expected === undefined) return false
  if (Array.isArray(fieldValue)) {
    return fieldValue.some((entry) => String(entry) === String(expected))
  }
  if (typeof fieldValue === 'string') {
    return fieldValue.includes(String(expected))
  }
  return false
}

const evaluateMembership = (
  fieldValue: FieldValue,
  expected: VisibleWhen['value'],
  positive: boolean
): boolean => {
  if (!Array.isArray(expected)) return !positive
  const fieldString = toScalarString(fieldValue)
  const matched = expected.some((entry) => String(entry) === fieldString)
  return positive ? matched : !matched
}

const evaluateOrdered = (
  fieldValue: FieldValue,
  expected: VisibleWhen['value'],
  compare: (a: number, b: number) => boolean
): boolean => {
  const left = toComparableNumber(fieldValue)
  if (left === undefined) return false
  const right =
    Array.isArray(expected) || expected === undefined
      ? undefined
      : toComparableNumber(expected as FieldValue)
  if (right === undefined) return false
  return compare(left, right)
}

/**
 * Per-operator dispatch table. Each entry receives the resolved field value
 * and the rule's `value` and returns the boolean evaluation result. The
 * dispatch shape keeps cyclomatic complexity inside `evaluateSimple` low
 * (the per-case `return` statements would otherwise push ESLint over its
 * complexity limit) without sacrificing the per-operator clarity of a
 * switch statement.
 */
type OperatorEvaluator = (fieldValue: FieldValue, expected: VisibleWhen['value']) => boolean

const SIMPLE_OPERATORS: Readonly<Record<string, OperatorEvaluator>> = {
  eq: (fieldValue, expected) =>
    toScalarString(fieldValue) === toScalarString(expected as FieldValue),
  neq: (fieldValue, expected) =>
    toScalarString(fieldValue) !== toScalarString(expected as FieldValue),
  contains: (fieldValue, expected) => evaluateContains(fieldValue, expected),
  empty: (fieldValue) => isAbsent(fieldValue),
  notEmpty: (fieldValue) => !isAbsent(fieldValue),
  gt: (fieldValue, expected) => evaluateOrdered(fieldValue, expected, (a, b) => a > b),
  gte: (fieldValue, expected) => evaluateOrdered(fieldValue, expected, (a, b) => a >= b),
  lt: (fieldValue, expected) => evaluateOrdered(fieldValue, expected, (a, b) => a < b),
  lte: (fieldValue, expected) => evaluateOrdered(fieldValue, expected, (a, b) => a <= b),
  in: (fieldValue, expected) => evaluateMembership(fieldValue, expected, true),
  notIn: (fieldValue, expected) => evaluateMembership(fieldValue, expected, false),
}

const evaluateSimple = (
  rule: VisibleWhen,
  values: Readonly<Record<string, FieldValue>>
): boolean => {
  const evaluator = SIMPLE_OPERATORS[rule.operator]
  if (evaluator === undefined) return false
  return evaluator(values[rule.field], rule.value)
}

/**
 * Evaluate a (possibly compound) `VisibleWhenCondition` against the
 * supplied field-value record. Returns `true` when the condition is
 * satisfied; `false` otherwise.
 *
 * `values` is a flat `name → value` map keyed by the submitter-facing
 * identifier (`column` for table-bound fields, `name` for standalone /
 * signature). The submit pipeline wires this directly off the resolved-
 * defaults body so `$query.X` references that already landed via
 * `defaultValue` naturally participate in the predicate.
 */
export const evaluateVisibleWhen = (
  condition: Readonly<VisibleWhenCondition>,
  values: Readonly<Record<string, FieldValue>>
): boolean => {
  if ('or' in condition) return condition.or.some((c) => evaluateVisibleWhen(c, values))
  if ('and' in condition) return condition.and.every((c) => evaluateVisibleWhen(c, values))
  return evaluateSimple(condition, values)
}
