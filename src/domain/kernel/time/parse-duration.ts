/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The duration grammar a configuration writes: a whole number and one unit.
 *
 * | Unit | Means                         |
 * | ---- | ----------------------------- |
 * | `ms` | milliseconds                  |
 * | `s`  | seconds                       |
 * | `m`  | minutes                       |
 * | `h`  | hours                         |
 * | `d`  | days of 24 hours              |
 * | `y`  | years of exactly 365 days     |
 *
 * A year is a fixed 365 days, never a calendar year: `1y` from 1 March 2028
 * ends on 1 March 2029 minus the leap day. A grammar that counted calendar
 * years would need a start date to say how long it is, and every place that
 * reads a duration compares it with a length of time, not a date.
 */

/** Milliseconds in one of each unit. */
export const DURATION_UNIT_MS = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  y: 365 * 86_400_000,
} as const

/** One unit of the grammar. */
export type DurationUnit = keyof typeof DURATION_UNIT_MS

/** A duration as a schema accepts it: digits, optional spaces, one unit. */
export const DURATION_PATTERN = /^(\d+)\s*(ms|s|m|h|d|y)$/

/** The units, as a description lists them. */
export const DURATION_UNITS_LABEL = 'ms, s, m, h, d or y, a year being 365 days'

/**
 * A `"<n><unit>"` duration in milliseconds, or `undefined` when the text is not
 * one. The unit is required: a bare number is not a duration here.
 */
export const durationToMs = (value: string): number | undefined => {
  const match = DURATION_PATTERN.exec(value.trim())
  if (match === null) return undefined
  return Number(match[1]) * DURATION_UNIT_MS[match[2] as DurationUnit]
}

/**
 * Parse a duration string (or plain integer) into milliseconds.
 *
 * Accepted formats:
 *   - "250ms", "5s", "10m", "2h", "7d", "6y" — integer + unit (see the grammar above),
 *     with optional spaces between them
 *   - "300" — plain integer interpreted as milliseconds
 *
 * Returns NaN on any other input. Callers handle invalid values explicitly
 * (e.g. by skipping the TTL or returning a configuration error). Returning
 * NaN is preferred over throwing because most callers want a soft fallback.
 */
export function parseDuration(input: string): number {
  const trimmed = input.trim()
  if (trimmed.length === 0) return NaN
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  return durationToMs(trimmed) ?? NaN
}
