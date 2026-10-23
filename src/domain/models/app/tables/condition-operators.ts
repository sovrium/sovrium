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

// The evaluators live in `condition-match-service.ts`, free of any `effect`
// import, so a browser island matching a record ships no schema with them.
export { matchesConditionOperators, satisfiesFieldCondition } from './condition-match-service'

/**
 * A per-record DISABLED predicate: the control is still drawn, but the reader
 * cannot use it while the condition holds.
 *
 * The SAME grammar as `visibleWhen` and `visibility.record` — a record `field`
 * and the shared operators — because all three answer a question about the
 * record the control is drawn on. What differs is the answer: `visibleWhen`
 * removes the control, `disabledWhen` keeps it in place and says why it cannot
 * be used, which is clearer when the reader would otherwise wonder where the
 * action went ("you need 8 credits" next to a greyed button).
 *
 * The condition is evaluated on the server, on the whole row, and only the
 * verdict reaches the page. The press is refused there too, so a crafted
 * request cannot run what the page shows disabled.
 *
 * Unlike `visibleWhen`, an absent `disabledWhen` means "never disabled", so a
 * caller must not pass it to {@link satisfiesFieldCondition}, which reads an
 * absent condition as "satisfied".
 *
 * @example
 * ```yaml
 * disabledWhen: { field: credit_balance, lt: 8 }
 * disabledReason: Il vous faut au moins 8 crédits.
 * ```
 */
export const DisabledWhenSchema = FieldConditionSchema.annotate({
  title: 'Disabled When',
  description:
    'Draws the control disabled on records whose named field satisfies the condition, instead of hiding it. The reader can still reach it and read why, but pressing it does nothing, and an automation it would start is refused by the server with 409. The condition is checked on the server against the whole record, even a field the reader may not read; only whether the control is disabled reaches the page, never the value it was decided on. Omit to keep the control usable on every record.',
  examples: [{ field: 'credit_balance', lt: 8 }],
})

/**
 * What a disabled control says about why it cannot be used.
 *
 * Shown as a tooltip when the control is hovered or focused, and always present
 * as the control's accessible description, so a screen reader announces it
 * without the pointer. Refused without a `disabledWhen` beside it, since it
 * would describe a state the control never reaches.
 */
export const DisabledReasonSchema = Schema.String.annotate({
  title: 'Disabled Reason',
  description:
    'Why the control is disabled, shown in a tooltip when it is hovered or focused and announced as its accessible description. Accepts `$record.<field>` (a field the reader may not read reads as empty) and a `$t:` translation key. Without it, the control is disabled with no explanation. Needs `disabledWhen`.',
  examples: ['Il vous faut au moins 8 crédits.', '$t:credits.notEnough'],
})

/** @public */
export type DisabledWhen = Schema.Schema.Type<typeof DisabledWhenSchema>
