/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatCalendarDate } from '@/domain/kernel/format/calendar-date'
import { formatDateTimeInstant } from '@/domain/kernel/format/date-time-instant'
import { formatDurationValue } from '@/domain/kernel/format/duration-format'
import { computeDurationClasses } from '../../design/cell-affordances-default-classes'
import { resolvePageLocale } from '../runtime/page-locale'
import { resolvePageTimezone } from '../runtime/page-timezone'
import { EMPTY_VALUE, isMissing } from './cell-empty'
import type { CellFieldOptions } from './cell-renderers'

/**
 * The grid's time-valued cells: a duration, a calendar day and a moment,
 * each formatted the way its field declares.
 */

// ──────────────────────────────────────────────────────────────────────────────
// DURATION — the declared preset, over a value stored in seconds
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a duration under its declared `displayFormat`. Postgres hands back the
 * `INTERVAL` string and SQLite the `INTEGER` count of seconds; the shared
 * formatter reads both, so the cell says the same thing on either dialect.
 */
export function DurationCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  const formatted = formatDurationValue(value, fieldOptions?.display?.displayFormat)
  if (formatted === undefined) return EMPTY_VALUE
  return <span className={computeDurationClasses()}>{formatted}</span>
}

// ──────────────────────────────────────────────────────────────────────────────
// DATE — a calendar day, the same day for every reader
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a `date` field as a calendar date in the page's language.
 *
 * A date carries no time of day: the API sends it as `YYYY-MM-DD`, or as the
 * UTC-midnight instant the driver decodes it to. Formatting that instant in
 * the reader's own zone would print the day before for everyone west of UTC,
 * so the day is formatted in UTC — which calendar day it is never depends on
 * who reads it. Only the LOCALE (month names, order) follows the page.
 */
export function DateCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  return (
    formatCalendarDate(value, fieldOptions?.locale, fieldOptions?.display?.weekday) ?? String(value)
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// DATETIME — a readable instant, not the wire encoding
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a stored instant the way a person reads one.
 *
 * `datetime` had no entry in the renderer registry, so a cell showed the raw
 * ISO string the API sends — a machine encoding, in a grid whose editor already
 * receives the field's declared `timeZone` precisely so the two can agree about
 * which day it is.
 *
 * A value that does not parse is passed through untouched rather than replaced
 * by "Invalid Date": showing something unexpected is recoverable, and losing the
 * value is not.
 */
export function DateTimeCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  return (
    formatDateTimeInstant(value, fieldOptions?.locale ?? resolvePageLocale(), {
      timeZone: fieldOptions?.timeZone ?? resolvePageTimezone(),
      ...(fieldOptions?.display?.weekday === undefined
        ? {}
        : { weekday: fieldOptions.display.weekday }),
    }) ?? String(value)
  )
}
