/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { FieldType } from '@/domain/models/app/tables/fields'

/**
 * The control a field type is edited with.
 *
 * Deliberately COARSER than the field-type union: many types share one
 * control. THREE dispatches switch on this widget — the SSR form skeleton, the
 * hydrated form island, and the data-table's inline cell editor — so no surface
 * can drift apart from the others per field type.
 *
 * The grid used to keep its own partial copy of this decision (a
 * `SELECT_FIELD_TYPES` set, a `NUMBER_FIELD_TYPES` set and a `resolveInputType`
 * chain in `editable-cell.tsx`), and eight field types fell through it to a
 * plain text box: six could not express their value at all, and `checkbox`,
 * `rating` and `datetime` looked editable while silently accepting prose. That
 * copy is gone; the widgets below are what replaced it.
 *
 * A widget names a CONTROL CLASS, not a rendering. Each surface still owns its
 * own total widget → control table, and they legitimately differ: the grid
 * gives `number` an `<input type="number">` while the form keeps a text box.
 * What they cannot do is disagree about WHICH class a field type belongs to.
 */
export type FieldWidget =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'email'
  | 'url'
  | 'textarea'
  | 'select'
  | 'multi-select'
  | 'record-picker'
  | 'user-picker'
  | 'checkbox'
  | 'rating'
  | 'code'
  | 'rich-text'
  | 'file-single'
  | 'file-multiple'
  /**
   * The odd one out: not an input at all. A `button` field holds no value to
   * collect — it is an action the author attached to the record — so the form
   * renders the action itself rather than a box to type into.
   */
  | 'button'

/** How a field type behaves in a CRUD form. */
export interface FieldTypeBehavior {
  /** Control used to edit the field, in BOTH the SSR skeleton and the island. */
  readonly widget: FieldWidget
  /**
   * `true` when an empty string is NOT a legal value for the backing column,
   * so an untouched field must be OMITTED from the write payload (letting the
   * column stay NULL / take its DB default) rather than sent as `''`.
   *
   * Established empirically against a live server: posting `''` to each column
   * type returns 500 (type/constraint rejection: numeric, temporal, array,
   * relationship, progress, geolocation, checkbox), 409 (CHECK-constraint
   * membership: single-select, status, color — see the note below), or 422
   * (format validation: url). Every such type is marked `true` here; the types
   * that legitimately accept `''` (free text, rich text, code, json, barcode,
   * attachments) are marked `false`.
   *
   * NOTE on 409: a CHECK-constraint violation is currently MISREPORTED as a
   * unique-constraint conflict on PostgreSQL (whose driver error carries a
   * `constraint` name for CHECK violations too) while SQLite surfaces the same
   * logical failure as a 500. That misclassification is tracked separately; it
   * does not change which types must be omitted.
   */
  readonly omitWhenEmpty: boolean
}

const TEXT_SENDS_EMPTY: FieldTypeBehavior = { widget: 'text', omitWhenEmpty: false }
const TEXT_OMITS_EMPTY: FieldTypeBehavior = { widget: 'text', omitWhenEmpty: true }
const SELECT_OMITS_EMPTY: FieldTypeBehavior = { widget: 'select', omitWhenEmpty: true }
const NUMBER_OMITS_EMPTY: FieldTypeBehavior = { widget: 'number', omitWhenEmpty: true }

/**
 * TOTAL field-type dispatch table.
 *
 * `satisfies Record<FieldType, FieldTypeBehavior>` is the whole point: adding
 * a field type to the domain's `FieldUnionSchema` breaks THIS file at compile
 * time, forcing an explicit decision about the control it renders with and
 * whether an empty value may be written — instead of silently falling through
 * to a text box that posts `''` and 500s in production.
 */
const FIELD_TYPE_BEHAVIOR = {
  // ── Text ────────────────────────────────────────────────────────────────
  'single-line-text': TEXT_SENDS_EMPTY,
  'long-text': { widget: 'textarea', omitWhenEmpty: false },
  'rich-text': { widget: 'rich-text', omitWhenEmpty: false },
  code: { widget: 'code', omitWhenEmpty: false },
  email: { widget: 'email', omitWhenEmpty: false },
  // A blank URL fails format validation (422) — omit so an untouched optional
  // link never blocks the submit.
  url: { widget: 'url', omitWhenEmpty: true },
  'phone-number': TEXT_SENDS_EMPTY,
  barcode: TEXT_SENDS_EMPTY,

  // ── Numeric (NUMERIC / INTEGER columns reject '') ───────────────────────
  integer: NUMBER_OMITS_EMPTY,
  decimal: NUMBER_OMITS_EMPTY,
  currency: NUMBER_OMITS_EMPTY,
  percentage: NUMBER_OMITS_EMPTY,
  // A score on a bounded scale, not a free number: `max` emits
  // CHECK (col >= 1 AND col <= max), so the scale is clicked, never typed —
  // and it clears to NULL, because the implicit minimum is 1 and 0 would
  // violate that CHECK.
  rating: { widget: 'rating', omitWhenEmpty: true },
  duration: NUMBER_OMITS_EMPTY,
  // 0..100 range CHECK constraint.
  progress: NUMBER_OMITS_EMPTY,

  // ── Temporal (DATE / TIMESTAMP / TIME columns reject '') ────────────────
  date: { widget: 'date', omitWhenEmpty: true },
  // TIMESTAMPTZ on Postgres / ISO text on SQLite. Edited as an instant in the
  // field's declared `timeZone`, never as free text.
  datetime: { widget: 'datetime', omitWhenEmpty: true },
  time: TEXT_OMITS_EMPTY,

  // ── Choice (option-membership CHECK constraints) ────────────────────────
  'single-select': SELECT_OMITS_EMPTY,
  status: SELECT_OMITS_EMPTY,
  // A SET, stored as `text[]` on Postgres. A text box would join it with
  // commas and write the string back, which is a different value.
  'multi-select': { widget: 'multi-select', omitWhenEmpty: true },

  // ── Structured / constrained scalars ────────────────────────────────────
  // BOOLEAN column rejects ''.
  checkbox: { widget: 'checkbox', omitWhenEmpty: true },
  // Hex-format CHECK constraint.
  color: TEXT_OMITS_EMPTY,
  geolocation: TEXT_OMITS_EMPTY,
  array: TEXT_OMITS_EMPTY,
  json: TEXT_SENDS_EMPTY,

  // ── Relational (FOREIGN KEY) ────────────────────────────────────────────
  // Both store a key the operator never sees. The control offers labels —
  // `displayField` for a record, the account's display name for a user — and
  // writes the key behind them.
  relationship: { widget: 'record-picker', omitWhenEmpty: true },
  user: { widget: 'user-picker', omitWhenEmpty: true },

  // ── Attachments (an empty string is not a storage key) ──────────────────
  'single-attachment': { widget: 'file-single', omitWhenEmpty: true },
  'multiple-attachments': { widget: 'file-multiple', omitWhenEmpty: true },

  // ── Computed / system-managed: never writable, so never send a blank ────
  formula: TEXT_OMITS_EMPTY,
  rollup: TEXT_OMITS_EMPTY,
  lookup: TEXT_OMITS_EMPTY,
  count: TEXT_OMITS_EMPTY,
  autonumber: TEXT_OMITS_EMPTY,
  // Not a readout either: a button field renders as the button it declares.
  // It has no column and no value, so nothing is ever sent for it.
  button: { widget: 'button', omitWhenEmpty: true },
  'created-at': TEXT_OMITS_EMPTY,
  'created-by': TEXT_OMITS_EMPTY,
  'updated-at': TEXT_OMITS_EMPTY,
  'updated-by': TEXT_OMITS_EMPTY,
  'deleted-at': TEXT_OMITS_EMPTY,
  'deleted-by': TEXT_OMITS_EMPTY,

  // ── AI-computed text columns (accept '' like any TEXT column) ───────────
  'ai-categorize': TEXT_SENDS_EMPTY,
  'ai-extract': TEXT_SENDS_EMPTY,
  'ai-generate': TEXT_SENDS_EMPTY,
  'ai-sentiment': TEXT_SENDS_EMPTY,
  'ai-summary': TEXT_SENDS_EMPTY,
  'ai-tag': TEXT_SENDS_EMPTY,
  'ai-translate': TEXT_SENDS_EMPTY,
} as const satisfies Record<FieldType, FieldTypeBehavior>

/**
 * Fallback for a `type` outside the union. Reachable at RUNTIME even though
 * the table is total at compile time: the domain deliberately accepts
 * unrecognized field types (`UnknownFieldSchema`), and the island rehydrates
 * its field list from a JSON blob. Behaves like a plain text box that posts
 * whatever it holds — the pre-existing behavior for an unmapped type.
 */
const UNKNOWN_FIELD_BEHAVIOR: FieldTypeBehavior = { widget: 'text', omitWhenEmpty: false }

/** Look up a field type's form behavior, degrading safely for unknown types. */
export function fieldTypeBehavior(type: string): FieldTypeBehavior {
  const table: Readonly<Record<string, FieldTypeBehavior | undefined>> = FIELD_TYPE_BEHAVIOR
  return table[type] ?? UNKNOWN_FIELD_BEHAVIOR
}

/** The control a field type renders with, in both SSR and hydrated views. */
export function fieldWidgetOf(type: string): FieldWidget {
  return fieldTypeBehavior(type).widget
}

/**
 * Widgets that PRESELECT a schema-declared `default` in the form.
 *
 * Only choice controls do. A choice control can only ever offer values the
 * schema declared, so showing the declared default is exactly what the record
 * will carry. For free-text and typed inputs a `default` may be a DB-side
 * SENTINEL rather than a literal — `datetime` accepts `default: 'now'` — and
 * pre-filling the control with `now` would submit that string verbatim and
 * fail the write. Those defaults stay where they belong: the column's
 * `DEFAULT` clause, applied when the field is omitted.
 *
 * Total over `FieldWidget` for the same reason as the tables above.
 */
const WIDGET_SHOWS_DECLARED_DEFAULT: Record<FieldWidget, boolean> = {
  select: true,
  text: false,
  number: false,
  date: false,
  datetime: false,
  email: false,
  url: false,
  textarea: false,
  // A multi-select IS a choice control, but its declared default is a LIST and
  // the preselect path handed to the form is a single string. Preselecting it
  // would need a second, list-shaped channel; the column's DEFAULT clause
  // already covers the omitted case, so it stays where the typed inputs are.
  'multi-select': false,
  'record-picker': false,
  'user-picker': false,
  checkbox: false,
  rating: false,
  code: false,
  'rich-text': false,
  'file-single': false,
  'file-multiple': false,
  button: false,
}

/** True when the form should preselect this field type's schema-declared `default`. */
export function showsDeclaredDefault(type: string): boolean {
  return WIDGET_SHOWS_DECLARED_DEFAULT[fieldWidgetOf(type)]
}

/**
 * True when an empty value for this field type must be dropped from a
 * create/update payload instead of written as `''`.
 */
export function omitsEmptyValue(type: string): boolean {
  return fieldTypeBehavior(type).omitWhenEmpty
}
