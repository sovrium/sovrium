/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { isEmptyCell } from '@/domain/kernel/matching/empty-value'
import { fieldLiteralOf } from './checkbox-literal-service'

/**
 * Scalar accepted by the comparison operators.
 */
const ConditionValueSchema = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).annotate({
  description: 'A value the field is compared against — a string, a number or a boolean.',
})

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
 * - `isEmpty` / `isNotEmpty` — presence test, written `isEmpty: true`. NULL,
 *   an absent value and `''` are all empty, the same rule the record filters
 *   apply, so a text column holding NULL on one row and `''` on another is
 *   tested alike. Spelled as a flag rather than a value comparison because
 *   neither `eq: ''` nor `gt` can express it: `eq` compares the stringified
 *   value (NULL reads as `"null"`), and `gt` is numeric.
 *
 * Lives with the `tables` property rather than beside any one consumer because three
 * unrelated surfaces now spend it — `table` `cellStyle[].when`, a
 * `table` action item's `visibleWhen`, and a `button` field's
 * `visibleWhen`. Co-locating it with the first of those would make the other
 * two import a page-component module to describe a table field.
 */
const describedValue = (description: string) => ConditionValueSchema.annotate({ description })
const describedValueArray = (description: string) =>
  ConditionValueArraySchema.annotate({ description })

/**
 * The presence flags take `true` and nothing else. `isEmpty: false` would be a
 * second spelling of `isNotEmpty: true`, and two spellings of one predicate are
 * how two surfaces come to disagree — so the negation has its own key and the
 * `false` form is refused at decode.
 */
const describedFlag = (description: string) =>
  Schema.Literal(true).annotate({ description, examples: [true] })

export const ConditionOperatorsSchema = Schema.Struct({
  /** Equals */
  eq: Schema.optional(describedValue('Matches when the value is equal to this one.')),
  /** Not equals */
  neq: Schema.optional(describedValue('Matches when the value is different from this one.')),
  /** Value is one of the listed values (set membership) */
  in: Schema.optional(describedValueArray('Matches when the value is one of the listed values.')),
  /** Value is NOT one of the listed values */
  notIn: Schema.optional(
    describedValueArray('Matches when the value is none of the listed values.')
  ),
  /** Substring / collection containment */
  contains: Schema.optional(
    describedValue('Matches when the value contains this text, or this entry for a list value.')
  ),
  /** Greater than */
  gt: Schema.optional(describedValue('Matches when the value is greater than this one.')),
  /** Less than */
  lt: Schema.optional(describedValue('Matches when the value is less than this one.')),
  /** Greater than or equal */
  gte: Schema.optional(
    describedValue('Matches when the value is greater than or equal to this one.')
  ),
  /** Less than or equal */
  lte: Schema.optional(describedValue('Matches when the value is less than or equal to this one.')),
  /** Value is empty: NULL, absent, '', [] or {} */
  isEmpty: Schema.optional(
    describedFlag(
      'Write `isEmpty: true` to match when the value is empty — no value at all, an empty text (\'\'), an empty list or an empty object. All of them count as empty, so a NULL, a blank text and a multi-select with nothing picked are tested alike. Nothing else is empty: `0`, `false`, a blank space, `{"a": null}` and `[null]` are values.'
    )
  ),
  /** Value is present: neither NULL, absent, '', [] nor {} */
  isNotEmpty: Schema.optional(
    describedFlag(
      "Write `isNotEmpty: true` to match when the value is present — neither missing, an empty text (''), an empty list nor an empty object. The one way to say \"this field has a value\", since `neq: ''` also matches a missing value."
    )
  ),
}).annotate({
  title: 'Condition Operators',
  description:
    'Condition matcher: { operator: value }. Supports eq, neq, in, notIn, contains, gt, lt, gte, lte, and the presence flags isEmpty: true / isNotEmpty: true.',
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
 * # "Call" shows only on rows that have a phone number
 * visibleWhen: { field: phone, isNotEmpty: true }
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
    'Per-record predicate: the target renders only on records whose `field` value satisfies the operator(s). Reuses the shared condition vocabulary (eq, neq, in, notIn, contains, gt, lt, gte, lte, isEmpty, isNotEmpty). Omit to show on every record.',
})

/** @public */
export type FieldCondition = Schema.Schema.Type<typeof FieldConditionSchema>

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
