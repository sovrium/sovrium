/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable unicorn/no-null --
   `null` is the value that CLEARS a column: it is SQL NULL on the wire, while
   `undefined` is dropped by JSON.stringify and reaches the endpoint as "leave
   this field alone". A blank typed into a numeric column means the former. */

/**
 * ONE rule for turning what a reader typed into what a column can hold.
 *
 * Three surfaces write values a reader produced as TEXT into typed columns —
 * the create dialog, the paste-from-spreadsheet import, and now the fill
 * handle — and before this module each carried its own copy of the decision.
 * The copies disagreed: the paste preview checked `number` and nothing else,
 * then let a mismatch through as a raw string; the create flow cast per type
 * but silently passed a non-numeric string on; inline editing coerced nothing.
 * A fourth copy for the fill handle would have been a fourth answer to the
 * same question, and the question is not one that tolerates four answers — a
 * column of numbers that quietly acquires the string `Pilot rollout` is the
 * corruption every one of these surfaces exists to avoid.
 *
 * So the decision is made here, once, and it is a decision with a NAME: a
 * value the destination cannot hold is refused with a message the reader can
 * act on, never written as something else. The surfaces differ only in what
 * they do with a refusal — the fill handle names it and lands the rest, the
 * paste preview flags the cell, the create dialog cannot produce one.
 */

/** A typed value the records API accepts for one field. */
export type CoercedFieldValue =
  string | number | boolean | null | readonly unknown[] | Readonly<Record<string, unknown>>

export type CoercionResult =
  | { readonly ok: true; readonly value: CoercedFieldValue }
  | { readonly ok: false; readonly reason: string }

/** Column types whose value must reach the API as a JSON number, not a string. */
const NUMERIC_TYPES: ReadonlySet<string> = new Set([
  'number',
  'integer',
  'decimal',
  'currency',
  'percent',
  'percentage',
  'rating',
  'duration',
  'progress',
])

/** Column types whose value must reach the API as a JSON boolean. */
const BOOLEAN_TYPES: ReadonlySet<string> = new Set(['checkbox', 'boolean'])

const TRUE_WORDS: ReadonlySet<string> = new Set(['true', '1', 'yes', 'on'])
const FALSE_WORDS: ReadonlySet<string> = new Set(['', 'false', '0', 'no', 'off'])

/**
 * Column types the server computes or stamps itself. Nothing a reader writes
 * into one of these can land, so no surface offers to: no fill handle, no
 * add-row control, no paste target.
 */
const COMPUTED_TYPES: ReadonlySet<string> = new Set([
  'formula',
  'rollup',
  'lookup',
  'count',
  'autonumber',
  'button',
  'created-at',
  'created-by',
  'updated-at',
  'updated-by',
  'deleted-at',
  'deleted-by',
])

/** True when the column is computed or system-managed and never written by a reader. */
export function isComputedFieldType(type: string | undefined): boolean {
  return type !== undefined && COMPUTED_TYPES.has(type)
}

/** True when a field's value should serialize as a JSON number. */
export function isNumericFieldType(type: string | undefined): boolean {
  return type !== undefined && NUMERIC_TYPES.has(type)
}

/** True when a field's value should serialize as a JSON boolean. */
export function isBooleanFieldType(type: string | undefined): boolean {
  return type !== undefined && BOOLEAN_TYPES.has(type)
}

const ok = (value: CoercedFieldValue): CoercionResult => ({ ok: true, value })
const refuse = (reason: string): CoercionResult => ({ ok: false, reason })

function coerceNumeric(raw: unknown, label: string): CoercionResult {
  if (typeof raw === 'number') return Number.isFinite(raw) ? ok(raw) : ok(null)
  if (typeof raw === 'boolean') return ok(raw ? 1 : 0)
  if (typeof raw !== 'string') return refuse(`${label} takes a number`)
  const trimmed = raw.trim()
  if (trimmed === '') return ok(null)
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? ok(parsed) : refuse(`${label} takes a number`)
}

function coerceBoolean(raw: unknown, label: string): CoercionResult {
  if (typeof raw === 'boolean') return ok(raw)
  if (typeof raw === 'number') return ok(raw !== 0)
  if (typeof raw !== 'string') return refuse(`${label} takes yes or no`)
  const word = raw.trim().toLowerCase()
  if (TRUE_WORDS.has(word)) return ok(true)
  if (FALSE_WORDS.has(word)) return ok(false)
  return refuse(`${label} takes yes or no`)
}

/**
 * Everything that is not numeric or boolean stores text, a key, or a
 * structure the API accepts verbatim. A scalar that came out of a typed column
 * is rendered to text so a text column never receives a JSON number.
 */
function coerceVerbatim(raw: unknown): CoercionResult {
  if (typeof raw === 'number' || typeof raw === 'boolean') return ok(String(raw))
  if (typeof raw === 'string' || Array.isArray(raw)) return ok(raw)
  if (typeof raw === 'object' && raw !== null) return ok(raw as Readonly<Record<string, unknown>>)
  return ok(String(raw))
}

/**
 * Coerce one value for one column.
 *
 * `raw` is usually the string a text control reports, but a value copied from
 * another CELL arrives already typed — a number read back from a numeric
 * column, a boolean from a checkbox, a list from a multi-select. A typed value
 * is taken at face value when the destination is of the same kind, rendered
 * to text when the destination is a text column, and REFUSED when it is
 * neither: a list dropped on a number column is not a number however it is
 * spelled.
 *
 * `label` is the column's display name — the word the refusal message
 * starts with, because "Amount takes a number" is something a reader can act
 * on and "invalid value" is not.
 */
export function coerceFieldValue(
  raw: unknown,
  fieldType: string | undefined,
  label: string
): CoercionResult {
  if (raw === undefined || raw === null) return ok(null)
  if (isNumericFieldType(fieldType)) return coerceNumeric(raw, label)
  if (isBooleanFieldType(fieldType)) return coerceBoolean(raw, label)
  return coerceVerbatim(raw)
}

/**
 * Coerce a whole value map, keeping every entry the rule accepts and reporting
 * the ones it refuses by field.
 *
 * The create dialog and the trailing add-row both post a map of typed fields;
 * both want the accepted half to land and the refused half named. Making the
 * split here means neither can accidentally send a refused value on anyway.
 */
export function coerceFieldValues(
  values: Readonly<Record<string, unknown>>,
  fieldTypes: ReadonlyMap<string, string>,
  labelOf: (field: string) => string = (field) => field
): {
  readonly accepted: Readonly<Record<string, CoercedFieldValue>>
  readonly refused: readonly { readonly field: string; readonly reason: string }[]
} {
  const outcomes = Object.entries(values).map(([field, raw]) => ({
    field,
    result: coerceFieldValue(raw, fieldTypes.get(field), labelOf(field)),
  }))
  const accepted = Object.fromEntries(
    outcomes.flatMap(({ field, result }) => (result.ok ? [[field, result.value] as const] : []))
  )
  const refused = outcomes.flatMap(({ field, result }) =>
    result.ok ? [] : [{ field, reason: result.reason }]
  )
  return { accepted, refused }
}
