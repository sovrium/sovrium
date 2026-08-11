/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared time-series bucketing for the admin overview tiles.
 *
 * `users-overview` and `automations-overview` both roll raw timestamped rows
 * into a dense, interval-aligned bucket grid for their `series.points`. This
 * module is the single source of truth for that logic so the two tiles cannot
 * drift apart — they previously disagreed on bucket alignment (users used
 * `floor`, automations used `ceil`), which is exactly the kind of divergence a
 * shared helper prevents.
 *
 * Convention: buckets are **floor-aligned** to the interval grid and keyed by
 * the ISO 8601 timestamp at the **start** of the bucket — matching the response
 * contract ("ISO timestamp at the start of the bucket") and the standard
 * charting convention. The grid is **dense**: every interval between `from` and
 * `to` is present, with empty buckets carrying the caller's zero value, so
 * chart libraries never have to fill gaps.
 *
 * `tables-overview` deliberately does NOT consume this module: it counts writes
 * via per-bucket SQL against a now-relative window rather than bucketing
 * in-memory rows, so it shares no surface here.
 */

/** One hour in milliseconds. */
export const HOUR_MS = 60 * 60 * 1000

/** One day in milliseconds. */
export const DAY_MS = 24 * HOUR_MS

/** Step size in milliseconds for a series interval. */
export const intervalStepMs = (interval: '1h' | '1d'): number =>
  interval === '1h' ? HOUR_MS : DAY_MS

/**
 * Coerce a `Date | string | number` timestamp to epoch milliseconds.
 *
 * Postgres returns `Date`; SQLite (via the drizzle `timestamp_ms` mode) also
 * returns `Date`, but a raw bigint may slip through the cast and some driver
 * paths yield ISO strings — all three are normalized here.
 */
export const coerceTimestampToMs = (value: Readonly<Date> | string | number): number => {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return new Date(value).getTime()
}

/**
 * Floor-align an epoch-ms value to the interval grid and return the ISO 8601
 * timestamp at the **start** of the containing bucket — the canonical bucket
 * key shared by the row folder and the dense grid below.
 */
export const bucketKeyForMs = (ms: number, stepMs: number): string =>
  new Date(Math.floor(ms / stepMs) * stepMs).toISOString()

/**
 * Fold rows into a map keyed by floor-aligned bucket-start ISO timestamp.
 *
 * `getTimestamp` extracts each row's timestamp; `accumulate` folds a row into
 * the running per-bucket value (starting from `initial`). Rows whose timestamp
 * precedes `fromMs` are skipped when `fromMs` is provided (the signups path
 * filters to the period window; the automations path receives pre-scoped rows
 * and omits it).
 */
export const bucketRowsByTimestamp = <R, V>(options: {
  readonly rows: ReadonlyArray<R>
  readonly getTimestamp: (row: R) => Readonly<Date> | string | number
  readonly stepMs: number
  readonly initial: V
  readonly accumulate: (acc: V, row: R) => V
  readonly fromMs?: number
}): ReadonlyMap<string, V> => {
  const { rows, getTimestamp, stepMs, initial, accumulate, fromMs } = options
  const folded = rows.reduce<Readonly<Record<string, V>>>((acc, row) => {
    const ms = coerceTimestampToMs(getTimestamp(row))
    if (fromMs !== undefined && ms < fromMs) return acc
    const key = bucketKeyForMs(ms, stepMs)
    return { ...acc, [key]: accumulate(acc[key] ?? initial, row) }
  }, {})
  return new Map(Object.entries(folded))
}

/**
 * Build a **dense**, floor-aligned bucket grid spanning `[from, to]`.
 *
 * Every bucket from `floor(from)` to `floor(to)` inclusive is present (an
 * `n`-step window yields `n + 1` points). Buckets absent from `rowsByBucket`
 * carry `emptyValue`. Each point is `{ timestamp, ...value }`, where
 * `timestamp` is the ISO bucket-start key.
 */
export const buildDenseBucketGrid = <V extends object>(options: {
  readonly fromIso: string
  readonly toIso: string
  readonly stepMs: number
  readonly rowsByBucket: ReadonlyMap<string, V>
  readonly emptyValue: V
}): ReadonlyArray<{ readonly timestamp: string } & V> => {
  const { fromIso, toIso, stepMs, rowsByBucket, emptyValue } = options
  const firstBucketMs = Math.floor(new Date(fromIso).getTime() / stepMs) * stepMs
  const lastBucketMs = Math.floor(new Date(toIso).getTime() / stepMs) * stepMs
  const count = Math.max(1, Math.round((lastBucketMs - firstBucketMs) / stepMs) + 1)
  return Array.from({ length: count }, (_unused, i) => {
    const timestamp = new Date(firstBucketMs + i * stepMs).toISOString()
    return { timestamp, ...(rowsByBucket.get(timestamp) ?? emptyValue) }
  })
}
