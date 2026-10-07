/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fieldWidgetOf, type FieldWidget } from './field-type-behavior'

/**
 * The native attributes a bound column's form control carries, decided ONCE for
 * the two places that draw it: the server-rendered skeleton and the hydrated
 * island. A page whose skeleton says `text` while its island says `number`
 * changes shape under the reader's cursor, so neither may keep its own copy of
 * the decision.
 */

/**
 * A typed column's own control configuration, read off the bound column and
 * carried on every form field def that draws it — the resolved def, the SSR
 * skeleton's and the island's. Declared once here so the three cannot drift.
 */
export interface TypedColumnConfig {
  /** Decimal places the column stores (`decimal`, `currency`, `percentage`). */
  readonly precision?: number
  /** ISO 4217 code of a `currency` column. */
  readonly currency?: string
  /** Whether a `currency` column shows its symbol before or after the amount. */
  readonly symbolPosition?: 'before' | 'after'
  /** Lower bound of a numeric column. */
  readonly min?: number
  /** Upper bound of a numeric column; the number of ranks of a `rating`. */
  readonly max?: number
  /** IANA zone a `datetime` column is read and written in. */
  readonly timeZone?: string
  /** Glyph of a `rating` column (`stars`, `hearts`, `circles`). */
  readonly ratingStyle?: string
}

/**
 * One option of a choice column as a form control offers it: the stored
 * `value` and the `label` drawn for it, already in the page language. Shared
 * by the resolved def, the SSR skeleton and the island's def.
 */
export interface ChoiceOption {
  readonly value: string
  readonly label: string
}

/** The slice of a form field these decisions read. */
export interface ControlAttributeField extends TypedColumnConfig {
  readonly type: string
}

/**
 * Native `<input type>` per plain-input widget. The widgets absent here own a
 * bespoke control (a select, a picker, a radio group), and fall back to `text`
 * wherever a plain placeholder input is drawn for them.
 */
const INPUT_TYPE_BY_WIDGET: Partial<Record<FieldWidget, string>> = {
  email: 'email',
  url: 'url',
  number: 'number',
  date: 'date',
  datetime: 'datetime-local',
}

/** The native `<input type>` a field is drawn with. */
export function nativeInputTypeOf(type: string): string {
  return INPUT_TYPE_BY_WIDGET[fieldWidgetOf(type)] ?? 'text'
}

/**
 * The component type a native form control is named after: the page component
 * that draws the same control. A drawer, a dialog or a hosted form draws its
 * controls itself, and names each one as a page would, so a reader counting by
 * `data-component-type` finds the same parts wherever they are drawn.
 */
const COMPONENT_TYPE_BY_INPUT_TYPE: Readonly<Record<string, string>> = {
  text: 'input',
  email: 'input',
  url: 'input',
  tel: 'input',
  password: 'input',
  search: 'input',
  number: 'number-input',
  date: 'date-picker',
  'datetime-local': 'date-picker',
  time: 'date-picker',
  checkbox: 'checkbox',
  file: 'file-upload',
}

/**
 * The `data-component-type` of an `<input type=…>`, or `undefined` for a type
 * no page component draws: an unnamed part is honest, a wrong name is not.
 */
export function inputComponentTypeOf(nativeInputType: string): string | undefined {
  return Object.hasOwn(COMPONENT_TYPE_BY_INPUT_TYPE, nativeInputType)
    ? COMPONENT_TYPE_BY_INPUT_TYPE[nativeInputType]
    : undefined
}

/** Decimal places an ISO currency is written with — 2 for EUR, 0 for JPY. */
function currencyDigitsOf(currency: string | undefined): number | undefined {
  if (currency === undefined) return undefined
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits
  } catch {
    // An unknown code is a config the currency column already rejects; the
    // control simply stays unstepped rather than throwing during render.
    return undefined
  }
}

/** `2` -> `'0.01'`, `0` -> `'1'`. Written out rather than computed in floats. */
function stepForDigits(digits: number): string {
  return digits <= 0 ? '1' : `0.${'0'.repeat(digits - 1)}1`
}

/**
 * The `step` a number control carries: one unit of the column's last stored
 * decimal place. `integer` steps by one. A column declaring no precision is
 * `any`, because a browser refuses to submit a value off the step grid and a
 * default of `1` would turn every undeclared decimal into an integer field.
 */
export function numericStepOf(field: ControlAttributeField): string {
  if (field.type === 'integer') return '1'
  const digits =
    field.precision ?? (field.type === 'currency' ? currencyDigitsOf(field.currency) : undefined)
  return digits === undefined ? 'any' : stepForDigits(digits)
}

/**
 * The keypad a number control opens on a phone. `decimal` for every numeric
 * column: an amount, a rate or a count all read on the same keypad, and the
 * one whose column stores no decimals is refused a fraction by its `step`.
 */
export const NUMBER_INPUT_MODE = 'decimal'

/**
 * The `inputMode` / `min` / `max` / `step` a number control carries, omitting
 * what is undeclared.
 */
export function numericInputAttributes(field: ControlAttributeField): {
  readonly inputMode: typeof NUMBER_INPUT_MODE
  readonly step: string
  readonly min?: number
  readonly max?: number
} {
  return {
    inputMode: NUMBER_INPUT_MODE,
    step: numericStepOf(field),
    ...(field.min !== undefined && { min: field.min }),
    ...(field.max !== undefined && { max: field.max }),
  }
}

/** The symbol shown beside a number control, and on which side of it. */
export interface NumericAdornment {
  readonly text: string
  readonly position: 'before' | 'after'
}

/** The narrow symbol of an ISO currency — `€` for EUR — or the code itself. */
export function currencySymbolOf(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0)
    return parts.find((part) => part.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

/**
 * The unit a number control shows beside itself. Display only: the symbol is
 * never part of the value the control holds or the form sends.
 */
export function numericAdornmentOf(field: ControlAttributeField): NumericAdornment | undefined {
  if (field.type === 'percentage') return { text: '%', position: 'after' }
  if (field.type === 'currency' && field.currency !== undefined) {
    return { text: currencySymbolOf(field.currency), position: field.symbolPosition ?? 'before' }
  }
  return undefined
}

/**
 * A stored calendar date as a `date` input holds it. A `DATE` column may read
 * back as a full ISO timestamp on one dialect; the input only ever takes the
 * `YYYY-MM-DD` head.
 */
export function toDateInputValue(value: string): string {
  const head = value.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : ''
}

/**
 * Carry a typed column's own control configuration onto the resolved field def,
 * so the form draws the control the data table edits that column with: a number
 * input stepped by `precision`, with its currency or percent sign and its bounds;
 * a date-and-time input read in the column's `timeZone`; a rating scale of `max`
 * ranks in the column's glyph. Returns an empty overlay for every other type so
 * the caller spreads it unconditionally. The table-bound crud form and the hosted
 * form both read it here, so a column is configured alike on both forms.
 */
export function resolveTypedColumnConfig(
  fieldType: string,
  tf: Readonly<Record<string, unknown>>
): TypedColumnConfig {
  const widget = fieldWidgetOf(fieldType)
  const numberProp = (key: string) => (typeof tf[key] === 'number' ? { [key]: tf[key] } : {})
  const stringProp = (key: string, as = key) =>
    typeof tf[key] === 'string' ? { [as]: tf[key] } : {}
  if (widget === 'number') {
    return {
      ...numberProp('precision'),
      ...numberProp('min'),
      ...numberProp('max'),
      ...stringProp('currency'),
      ...stringProp('symbolPosition'),
    }
  }
  if (widget === 'rating') return { ...numberProp('max'), ...stringProp('style', 'ratingStyle') }
  if (widget === 'datetime') return stringProp('timeZone')
  return {}
}
