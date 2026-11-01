/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The buckets `chartAggregate.fillEmpty` steps through, from a first bucket to
 * a last one, for every interval.
 *
 * A minute, an hour, a day and a week have a fixed length; a month, a quarter
 * and a year do not, so they step by the calendar (UTC): January, February,
 * March, never thirty-day slices that drift off the first of the month. Pure,
 * and free of imports, because the chart island reads it in the browser.
 */

/** The most buckets one aggregate read returns, and so the most a chart can fill. */
export const FILL_BUCKET_LIMIT = 500

const FIXED_STEP_MS: Readonly<Record<string, number>> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
}

/** How many months each calendar interval spans. */
const CALENDAR_STEP_MONTHS: Readonly<Record<string, number>> = {
  month: 1,
  quarter: 3,
  year: 12,
}

const QUARTER_KEY = /^(\d{4})-Q([1-4])$/
const YEAR_KEY = /^\d{4}$/

/**
 * The first instant (ms since the epoch, UTC) of the bucket a key names: an
 * ISO instant, a day (`YYYY-MM-DD`), a month (`YYYY-MM`), a quarter
 * (`YYYY-Q1`) or a year (`YYYY`). `NaN` for anything else.
 */
export function bucketKeyStart(key: string): number {
  const quarter = QUARTER_KEY.exec(key)
  if (quarter !== null) return Date.UTC(Number(quarter[1]), (Number(quarter[2]) - 1) * 3, 1)
  if (YEAR_KEY.test(key)) return Date.UTC(Number(key), 0, 1)
  return Date.parse(key)
}

/** The first instant of the bucket after the one starting at `time`; `undefined` for an unknown interval. */
export function nextBucketStart(time: number, interval: string): number | undefined {
  const fixed = FIXED_STEP_MS[interval]
  if (fixed !== undefined) return time + fixed
  const months = CALENDAR_STEP_MONTHS[interval]
  if (months === undefined) return undefined
  const date = new Date(time)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
}

/**
 * The first instant of every bucket from the one starting at `from` to the
 * one starting at `to`, both included, at most {@link FILL_BUCKET_LIMIT} of
 * them. Empty when the window is empty or not a window at all.
 */
export function bucketStartsBetween(from: number, to: number, interval: string): readonly number[] {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return []
  return Array.from({ length: FILL_BUCKET_LIMIT - 1 }).reduce<readonly number[]>(
    (starts) => {
      const last = starts[starts.length - 1] ?? from
      const next = nextBucketStart(last, interval)
      return next === undefined || next > to || next <= last ? starts : [...starts, next]
    },
    [from]
  )
}
