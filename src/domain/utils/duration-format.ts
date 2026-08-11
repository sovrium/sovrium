/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Duration display formatting, shared by the records API's `?format=display`
 * path and the data-table's read-only grid cell.
 *
 * ## The stored unit is SECONDS, and the two dialects disagree on the shape
 *
 * A `duration` column is `INTERVAL` on Postgres and `INTEGER` on SQLite, and
 * both hold *a count of seconds*. What reaches this module differs by driver:
 *
 *  - Postgres hands back the interval **string** (`'01:00:00'`, or the verbose
 *    `'1 hour 30 minutes'` form).
 *  - SQLite hands back the **number** (`3600`).
 *
 * So a formatter that normalises only one representation leaves the other
 * broken. {@link durationToSeconds} accepts both and answers in seconds.
 *
 * ## Why this module exists rather than re-using the old helper
 *
 * The previous implementation bound the raw numeric value to a variable named
 * `totalMinutes` and divided it by 60 to get hours — so a numeric duration was
 * read as MINUTES and rendered **60x too large** (`3600` → `60:00` instead of
 * `1:00`). Its string branch was correct, which is why the defect only ever
 * surfaced where the driver hands back a number. Parsing straight to seconds
 * removes the ambiguity: there is now one unit in the module and it is the unit
 * the schema, the SQL mapping and the published docs all name.
 *
 * Effect-free by construction: the data-table island imports this, and pulling
 * `effect` into a browser bundle for a number-to-string conversion is not a
 * trade worth making.
 */

/** The three display presets a `duration` field may declare. */
export type DurationDisplayFormat = 'h:mm' | 'h:mm:ss' | 'decimal'

const SECONDS_PER_HOUR = 3600
const SECONDS_PER_MINUTE = 60

/** `HH:MM` or `HH:MM:SS` — the clock form a Postgres `INTERVAL` renders as. */
const CLOCK_FORM = /^(\d+):(\d{2})(?::(\d{2}))?$/

/** Sum a matched `[, hours, minutes, seconds?]` clock into seconds. */
const clockPartsToSeconds = (parts: Readonly<RegExpExecArray>): number =>
  parseInt(parts[1] ?? '0', 10) * SECONDS_PER_HOUR +
  parseInt(parts[2] ?? '0', 10) * SECONDS_PER_MINUTE +
  parseInt(parts[3] ?? '0', 10)

/** A trailing `HH:MM:SS` clock, as Postgres appends to `1 day 02:00:00`. */
const CLOCK_TAIL = /(\d+):(\d{2}):(\d{2})\s*$/

/**
 * Sum Postgres' verbose interval text (`1 hour 30 minutes`), including the
 * mixed `1 day 02:00:00` form the driver emits once a duration passes a day.
 */
const verboseIntervalToSeconds = (value: string): number => {
  const unitSeconds: readonly (readonly [RegExp, number])[] = [
    [/(\d+)\s*days?/, 24 * SECONDS_PER_HOUR],
    [/(\d+)\s*hours?/, SECONDS_PER_HOUR],
    [/(\d+)\s*mins?(?:utes?)?/, SECONDS_PER_MINUTE],
    [/(\d+)\s*secs?(?:onds?)?/, 1],
  ]
  const named = unitSeconds.reduce((total, [pattern, multiplier]) => {
    const matched = pattern.exec(value)
    return matched ? total + parseInt(matched[1] ?? '0', 10) * multiplier : total
  }, 0)

  const tail = CLOCK_TAIL.exec(value)
  return named + (tail ? clockPartsToSeconds(tail) : 0)
}

/**
 * Normalise whatever the driver handed back into a count of seconds.
 *
 * Returns `undefined` for a value that names no duration at all, so a caller
 * can tell "zero seconds" (which must still format, as `0:00`) apart from
 * "nothing stored" (which must render the shared empty placeholder).
 */
export const durationToSeconds = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined

  const text = String(value).trim()
  const clock = CLOCK_FORM.exec(text)
  if (clock) return clockPartsToSeconds(clock)

  // A bare numeric string is the SQLite integer that survived a JSON round-trip.
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)

  const verbose = verboseIntervalToSeconds(text)
  return verbose > 0 ? verbose : undefined
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/**
 * Render a duration, already in seconds, under one of the three declared
 * presets. `h:mm` is the schema default.
 */
export const formatDurationSeconds = (
  seconds: number,
  displayFormat: DurationDisplayFormat = 'h:mm'
): string => {
  if (displayFormat === 'decimal') return (seconds / SECONDS_PER_HOUR).toFixed(1)

  const hours = Math.floor(seconds / SECONDS_PER_HOUR)
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  if (displayFormat === 'h:mm:ss') {
    return `${String(hours)}:${pad2(minutes)}:${pad2(Math.floor(seconds % SECONDS_PER_MINUTE))}`
  }
  return `${String(hours)}:${pad2(minutes)}`
}

/**
 * Format a raw stored duration value (string interval or numeric seconds)
 * under its declared preset. Returns `undefined` when the value names no
 * duration, so the caller owns the empty-cell decision.
 */
export const formatDurationValue = (
  value: unknown,
  displayFormat?: DurationDisplayFormat
): string | undefined => {
  const seconds = durationToSeconds(value)
  return seconds === undefined ? undefined : formatDurationSeconds(seconds, displayFormat)
}
