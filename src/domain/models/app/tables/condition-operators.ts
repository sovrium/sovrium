/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Scalar accepted by the comparison operators.
 */
const ConditionValueSchema = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])

/** Array of values for the set-membership operators (`in` / `notIn`). */
const ConditionValueArraySchema = Schema.Array(ConditionValueSchema)

/**
 * Shared condition-matcher vocabulary.
 *
 * The single operator set behind every value-keyed predicate in the config
 * surface. Every operator is optional — callers supply exactly the one(s) they
 * need, and supplying several ANDs them.
 *
 * Operators:
 * - `eq` / `neq`   — equals / not-equals against a scalar
 * - `in` / `notIn` — set membership against a list of values
 * - `contains`     — substring / collection containment
 * - `gt`/`lt`/`gte`/`lte` — numeric comparisons
 *
 * Lives in `shared/` rather than beside any one consumer because three
 * unrelated surfaces now spend it — `table` `cellStyle[].when`, a
 * `table` action item's `visibleWhen`, and a `button` field's
 * `visibleWhen`. Co-locating it with the first of those would make the other
 * two import a page-component module to describe a table field.
 */
export const ConditionOperatorsSchema = Schema.Struct({
  /** Equals */
  eq: Schema.optional(ConditionValueSchema),
  /** Not equals */
  neq: Schema.optional(ConditionValueSchema),
  /** Value is one of the listed values (set membership) */
  in: Schema.optional(ConditionValueArraySchema),
  /** Value is NOT one of the listed values */
  notIn: Schema.optional(ConditionValueArraySchema),
  /** Substring / collection containment */
  contains: Schema.optional(ConditionValueSchema),
  /** Greater than */
  gt: Schema.optional(ConditionValueSchema),
  /** Less than */
  lt: Schema.optional(ConditionValueSchema),
  /** Greater than or equal */
  gte: Schema.optional(ConditionValueSchema),
  /** Less than or equal */
  lte: Schema.optional(ConditionValueSchema),
}).annotate({
  title: 'Condition Operators',
  description:
    'Condition matcher: { operator: value }. Supports eq, neq, in, notIn, contains, gt, lt, gte, lte.',
})

/** @public */
export type ConditionOperators = Schema.Schema.Type<typeof ConditionOperatorsSchema>

/**
 * A per-record visibility predicate: name the record `field` to test, then
 * apply the shared operator vocabulary to that field's value.
 *
 * Used wherever something is shown on SOME records and not others — a
 * `table` action item, a `button` field. The predicate has no field
 * binding of its own (unlike `cellStyle[].when`, which is matched against the
 * column's own cell value), so it names the field explicitly.
 *
 * @example
 * ```yaml
 * # "Ship" shows only on pending rows
 * visibleWhen: { field: status, eq: pending }
 * # "Renew" shows only on expiring/expired rows
 * visibleWhen: { field: status, in: [expiring, expired] }
 * ```
 */
export const FieldConditionSchema = Schema.Struct({
  /** Record field whose value the predicate is matched against */
  field: Schema.String.annotate({
    description: 'Record field whose value the visibility predicate is matched against',
  }),
  ...ConditionOperatorsSchema.fields,
}).annotate({
  title: 'Field Condition',
  description:
    'Per-record predicate: the target renders only on records whose `field` value satisfies the operator(s). Reuses the shared condition vocabulary (eq, neq, in, notIn, contains, gt, lt, gte, lte). Omit to show on every record.',
})

/** @public */
export type FieldCondition = Schema.Schema.Type<typeof FieldConditionSchema>

/**
 * Apply one operator to an already-coerced pair of representations.
 *
 * Comparison is string-based for the equality/membership/containment family
 * and numeric for the ordering family, so a `status` column holding `'3'`
 * satisfies both `eq: '3'` and `gt: 2`. An unknown operator matches nothing
 * rather than throwing — the schema already constrains the vocabulary, and a
 * value arriving from a rehydrated JSON blob must not crash a render.
 */
const matchesCondition = (
  operator: string,
  expected: unknown,
  strValue: string,
  numValue: number
): boolean => {
  const matchers: Readonly<Record<string, () => boolean>> = {
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
  const strValue = String(value)
  const numValue = Number(value)
  return Object.entries(operators)
    .filter(([, expected]) => expected !== undefined)
    .every(([operator, expected]) => matchesCondition(operator, expected, strValue, numValue))
}

/**
 * Evaluate a {@link FieldConditionSchema} predicate against one record.
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
