/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Google Sheets cells as raw cells the shared type inference reads, plus what
 * each cell states about its column. Pinned under
 * `[internal ref]` (facts d4 to d11, e1 to e4).
 *
 * A cell (`CellData`) is read from its `effectiveValue` — the value the sheet
 * computed, so a formula keeps its last result — and its number format:
 *
 * - A number formatted `DATE`, `DATE_TIME` or `TIME` is a serial number of
 *   days since 1899-12-30; it becomes the ISO text inference reads as a date,
 *   a date-time or a time.
 * - A `PERCENT` number is a fraction (`0.1`); it becomes `10%`.
 * - A `CURRENCY` number keeps the text the sheet showed (`€49.00`) when that
 *   text is a plain amount, so inference reads a currency.
 * - A person chip is its email; a link chip standing alone is its link.
 * - A cell in error (`#DIV/0!`) holds nothing.
 *
 * What a cell states about its column is its format type, its data validation
 * (a dropdown's choices) and whether it is a formula.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import type { RawCell } from './inferred-types-service'

/** One cell read: its value, and what it states about its column. */
export interface SheetCell {
  readonly value: RawCell
  /** The number format type, when the cell has one (`DATE`, `CURRENCY`, …). */
  readonly format?: string
  /** The currency symbol a `CURRENCY` pattern names (`[$€]#,##0.00`). */
  readonly symbol?: string
  /** The data-validation condition type (`ONE_OF_LIST`, `BOOLEAN`, …). */
  readonly validation?: string
  /** A `ONE_OF_LIST` validation's choices. */
  readonly choices?: readonly string[]
  /** Whether the cell holds a formula. */
  readonly formula: boolean
}

type Json = Readonly<Record<string, unknown>>

const DAY_MS = 86_400_000
/** Day zero of a Sheets serial date. */
const EPOCH_MS = Date.UTC(1899, 11, 30)

const PLAIN_AMOUNT = /^[$€£]\s?-?\d{1,3}(?:,?\d{3})*(?:\.\d+)?$/
const PATTERN_SYMBOL = /\[\$([^\]-]+)/

/** A serial date as ISO text, cut to what the format shows. */
const serialText = (serial: number, format: string): string => {
  const iso = new Date(Math.round(EPOCH_MS + serial * DAY_MS)).toISOString()
  if (format === 'DATE') return iso.slice(0, 10)
  if (format === 'TIME') return iso.slice(11, 19)
  return iso.slice(0, 19)
}

/** A fraction as the percentage text inference reads, rounded so `0.07` stays `7%`. */
const percentText = (fraction: number): string =>
  `${String(Math.round(fraction * 100 * 1e9) / 1e9)}%`

const numberCell = (value: number, format: string | undefined, shown: unknown): RawCell => {
  if (!Number.isFinite(value)) return undefined
  if (format === 'DATE' || format === 'DATE_TIME' || format === 'TIME') {
    return serialText(value, format)
  }
  if (format === 'PERCENT') return percentText(value)
  if (format === 'CURRENCY' && typeof shown === 'string' && PLAIN_AMOUNT.test(shown.trim())) {
    return shown.trim()
  }
  return value
}

/** The value of a cell whose text is chips: the person's email, or a lone link. */
const chipValue = (cell: Json): string | undefined => {
  const runs = Array.isArray(cell['chipRuns']) ? cell['chipRuns'].filter(isRecord) : []
  const chips = runs.map((run) => (isRecord(run['chip']) ? run['chip'] : undefined))
  const [only] = chips
  if (chips.length !== 1 || only === undefined) return undefined
  const person = isRecord(only['personProperties']) ? only['personProperties'] : undefined
  if (typeof person?.['email'] === 'string') return person['email']
  const link = isRecord(only['richLinkProperties']) ? only['richLinkProperties'] : undefined
  return typeof link?.['uri'] === 'string' ? link['uri'] : undefined
}

const valueOf = (cell: Json, format: string | undefined): RawCell => {
  const effective = isRecord(cell['effectiveValue']) ? cell['effectiveValue'] : undefined
  if (effective === undefined || 'errorValue' in effective) return undefined
  const chip = chipValue(cell)
  if (chip !== undefined) return chip
  if (typeof effective['numberValue'] === 'number') {
    return numberCell(effective['numberValue'], format, cell['formattedValue'])
  }
  if (typeof effective['boolValue'] === 'boolean') return effective['boolValue']
  return typeof effective['stringValue'] === 'string' ? effective['stringValue'] : undefined
}

const formatOf = (cell: Json): Json | undefined => {
  const effective = isRecord(cell['effectiveFormat']) ? cell['effectiveFormat'] : undefined
  const user = isRecord(cell['userEnteredFormat']) ? cell['userEnteredFormat'] : undefined
  const number = effective?.['numberFormat'] ?? user?.['numberFormat']
  return isRecord(number) ? number : undefined
}

const choicesOf = (condition: Json): readonly string[] =>
  (Array.isArray(condition['values']) ? condition['values'] : []).flatMap((value) =>
    isRecord(value) && typeof value['userEnteredValue'] === 'string'
      ? [value['userEnteredValue']]
      : []
  )

/** The number format a cell states: its type and the currency symbol its pattern names. */
const numberFormatOf = (cell: Json): { readonly format?: string; readonly symbol?: string } => {
  const number = formatOf(cell)
  const format = typeof number?.['type'] === 'string' ? number['type'] : undefined
  const pattern = typeof number?.['pattern'] === 'string' ? number['pattern'] : ''
  const symbol = PATTERN_SYMBOL.exec(pattern)?.[1]
  return {
    ...(format === undefined ? {} : { format }),
    ...(symbol === undefined ? {} : { symbol }),
  }
}

/** The data validation a cell states: its condition type and a dropdown's choices. */
const validationOf = (
  cell: Json
): { readonly validation?: string; readonly choices?: readonly string[] } => {
  const rule = isRecord(cell['dataValidation']) ? cell['dataValidation'] : {}
  const condition = isRecord(rule['condition']) ? rule['condition'] : {}
  const validation = condition['type']
  if (typeof validation !== 'string') return {}
  return validation === 'ONE_OF_LIST'
    ? { validation, choices: choicesOf(condition) }
    : { validation }
}

/** One `CellData` as a raw cell and the signals it carries. */
export const sheetCellOf = (cell: unknown): SheetCell => {
  if (!isRecord(cell)) return { value: undefined, formula: false }
  const number = numberFormatOf(cell)
  const entered = isRecord(cell['userEnteredValue']) ? cell['userEnteredValue'] : {}
  return {
    value: valueOf(cell, number.format),
    formula: typeof entered['formulaValue'] === 'string',
    ...number,
    ...validationOf(cell),
  }
}
