/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatCalendarDate } from '@/domain/kernel/format/calendar-date'
import { usableLocale } from '@/domain/kernel/format/usable-locale'
import { computeFormulaReadonlyClasses } from '../../design/cell-affordances-default-classes'
import { resolvePageTimezone } from '../runtime/page-timezone'
import { EMPTY_VALUE, isMissing } from './cell-empty'
import type { CellFieldOptions } from './cell-renderers'

/**
 * A formula field's read-only cell: the kind of value the formula produced
 * (date, number, error or text) decides how it is drawn.
 */

// ──────────────────────────────────────────────────────────────────────────────
// FORMULA read-only (kind-dispatched)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * A date the API sends as text: `YYYY-MM-DD`, or an ISO instant. A formula's
 * date result reaches the island over JSON, so it is a STRING, never a `Date`.
 */
const ISO_DATE_VALUE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

/** A `Date`, or a string the API sends a date as. */
const readsAsDate = (value: unknown): boolean =>
  value instanceof Date || (typeof value === 'string' && ISO_DATE_VALUE.test(value))

/** A formula error value: `#DIV/0!`, `#REF!`, … */
const readsAsError = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith('#') && value.endsWith('!')

/** A number, or a string that parses as one. */
const readsAsNumber = (value: unknown): boolean =>
  typeof value === 'number' || (typeof value === 'string' && !Number.isNaN(Number(value)))

/** True when the formula's author declared its result as text. */
const declaresText = (fieldOptions: CellFieldOptions | undefined): boolean =>
  fieldOptions?.display?.resultType === 'text'

/**
 * The kind a formula result renders as. Without a declared kind the value is
 * sniffed — but a formula its author declared `resultType: 'text'` is never
 * read as a date, so `DATETIME_FORMAT(x, 'YYYY-MM-DD')` prints what it built.
 */
const detectFormulaKind = (
  value: unknown,
  fieldOptions: CellFieldOptions | undefined
): 'number' | 'text' | 'date' | 'error' => {
  const declared = fieldOptions?.formulaKind
  if (declared) return declared
  if (readsAsError(value)) return 'error'
  if (readsAsNumber(value)) return 'number'
  return !declaresText(fieldOptions) && readsAsDate(value) ? 'date' : 'text'
}

/** A value naming a calendar day only: `YYYY-MM-DD`, or a UTC-midnight instant. */
const namesCalendarDay = (value: unknown, parsed: Date): boolean =>
  (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) ||
  parsed.getTime() % 86_400_000 === 0

/**
 * A date-valued formula result in the page's language. A calendar day keeps
 * its own day for every reader; an instant carrying a time of day is placed on
 * its day in the zone the grid already uses for instants — the field's, else
 * the page's.
 */
function formatFormulaDate(value: unknown, fieldOptions: CellFieldOptions | undefined): string {
  const parsed = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return String(value)
  const locale = fieldOptions?.locale
  if (namesCalendarDay(value, parsed)) return formatCalendarDate(parsed, locale) ?? String(value)
  const timeZone = fieldOptions?.timeZone ?? resolvePageTimezone()
  return formatInstantDay(parsed, usableLocale(locale ?? 'en-US'), timeZone)
}

/** An instant's day, in `timeZone` — the runtime's own zone when that one is unknown. */
function formatInstantDay(instant: Date, locale: string, timeZone: string | undefined): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone }).format(instant)
  } catch {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(instant)
  }
}

/**
 * Render a formula-field readout. Kind comes from the schema if declared,
 * else inferred from the value shape (numeric / error sigil / Date / else).
 */
export function FormulaReadonlyCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const kind = detectFormulaKind(value, fieldOptions)
  // A date result arrives over JSON as a STRING, so it is the string that is
  // formatted — as a calendar date in the page's language, never the raw
  // instant and never in the browser's own language.
  const display = kind === 'date' ? formatFormulaDate(value, fieldOptions) : String(value)
  return (
    <span
      data-cell-ink=""
      className={computeFormulaReadonlyClasses({ kind })}
    >
      {display}
    </span>
  )
}
