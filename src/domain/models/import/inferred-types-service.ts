/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Type inference for the schemaless sources — CSV, XLSX, Google Sheets and
 * Zapier Tables.
 *
 * A column is the FIRST kind of {@link INFERRED_KINDS} every non-empty value
 * fits, so the order of that list is the whole policy: a column of `true` and
 * `false` is a checkbox before it is text, a column of `12` and `240` is an
 * integer before it is a decimal. One value that fits nothing narrower makes
 * the column text — inference never guesses past the evidence. The inferred
 * kind is then looked up in the shared field-type table, like any source type.
 *
 * ## A guard is not data
 *
 * Spreadsheet tools defend a cell that starts with `=`, `+`, `-` or `@`
 * against formula injection by writing it with a leading apostrophe
 * (`'=1+1`). The apostrophe is the exporting tool's, not the operator's,
 * so it is stripped before inference; the text it protected is kept as text.
 */

import { INFERRED_KINDS } from './field-type-mappings'

/** One inferred column kind. */
export type InferredKind = (typeof INFERRED_KINDS)[number]

/** A raw cell: text from a CSV, or a typed value from a workbook. */
export type RawCell = string | number | boolean | undefined | null

const BOOLEAN = /^(?:true|false|yes|no)$/i
const INTEGER = /^-?(?:0|[1-9]\d*)$/
const DECIMAL = /^-?(?:0|[1-9]\d*)\.\d+$/
const PERCENT = /^-?\d+(?:\.\d+)?%$/
const CURRENCY = /^[$€£]\s?-?\d{1,3}(?:,?\d{3})*(?:\.\d+)?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/
const TIME = /^\d{2}:\d{2}(?::\d{2})?$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_VALUE = /^https?:\/\/\S+$/i

/** The characters a spreadsheet guards with a leading apostrophe. */
const GUARDED = /^'[=+\-@\t\r]/

/** A cell with the exporting tool's formula-injection guard removed. */
export const stripFormulaGuard = (value: string): string =>
  GUARDED.test(value) ? value.slice(1) : value

/** A calendar date that exists: February 30th is not one. */
const isRealDate = (value: string): boolean => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** How a text value fits each kind; the validation kinds come from a sheet's rules, never values. */
const TEXT_FITS: Readonly<Record<InferredKind, (text: string) => boolean>> = {
  boolean: (text) => BOOLEAN.test(text),
  integer: (text) => INTEGER.test(text) && Number.isSafeInteger(Number(text)),
  decimal: (text) => DECIMAL.test(text) || INTEGER.test(text),
  percent: (text) => PERCENT.test(text),
  currency: (text) => CURRENCY.test(text),
  date: (text) => DATE.test(text) && isRealDate(text),
  datetime: (text) => DATETIME.test(text) && isRealDate(text),
  time: (text) => TIME.test(text),
  email: (text) => EMAIL.test(text),
  url: (text) => URL_VALUE.test(text),
  'list-validation': () => false,
  'checkbox-validation': () => false,
  'multiline-text': () => true,
  text: (text) => !text.includes('\n'),
}

/** Whether one non-empty value fits one kind. */
const fits = (kind: InferredKind, value: RawCell): boolean => {
  if (typeof value === 'boolean') return kind === 'boolean'
  if (typeof value === 'number')
    return kind === 'decimal' || (kind === 'integer' && Number.isInteger(value))
  return TEXT_FITS[kind](String(value))
}

/** Whether a cell holds nothing. */
export const isEmptyCell = (value: RawCell): value is undefined | null | '' =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

/**
 * Whether every non-empty value of a column fits one kind — how a kind the
 * source declares (a Sheets number format, a table column type) is checked
 * against the evidence before it is trusted. A column with no value fits.
 */
export const columnFits = (kind: InferredKind, values: readonly RawCell[]): boolean =>
  values.filter((value) => !isEmptyCell(value)).every((value) => fits(kind, value))

/**
 * The kind of a column from its values. Empty cells are ignored; a column with
 * no value at all is text. A multi-line value anywhere makes the column
 * multi-line text, because a single-line field would refuse it.
 */
export const inferColumnKind = (values: readonly RawCell[]): InferredKind => {
  const present = values.filter((value) => !isEmptyCell(value))
  if (present.length === 0) return 'text'
  if (present.some((value) => typeof value === 'string' && value.includes('\n'))) {
    return 'multiline-text'
  }
  const order = INFERRED_KINDS.filter((kind) => kind !== 'multiline-text')
  return order.find((kind) => present.every((value) => fits(kind, value))) ?? 'text'
}

const toNumber = (value: string): number => Number(value.replace(/[$€£,%\s]/g, ''))

const NUMERIC_KINDS: ReadonlySet<InferredKind> = new Set([
  'integer',
  'decimal',
  'percent',
  'currency',
])
const BOOLEAN_KINDS: ReadonlySet<InferredKind> = new Set(['boolean', 'checkbox-validation'])

/**
 * One cell as the value of a field of the inferred kind, or `undefined` for an
 * empty cell (an empty cell is absent, never an empty string).
 */
export const convertCell = (
  kind: InferredKind,
  value: RawCell
): string | number | boolean | undefined => {
  if (isEmptyCell(value)) return undefined
  if (typeof value === 'boolean' || typeof value === 'number') return value
  if (BOOLEAN_KINDS.has(kind)) return /^(?:true|yes)$/i.test(value)
  return NUMERIC_KINDS.has(kind) ? toNumber(value) : value
}
