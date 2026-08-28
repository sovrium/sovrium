/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared time-series bucketing for the admin overview tiles.
 *
 * `users-overview`, `automations-overview` and `buckets-overview` all roll raw
 * timestamped rows into a series of points for their `series.points`. This module
 * is the single source of truth for that logic so the tiles cannot drift apart —
 * users and automations previously disagreed on bucket alignment (users used
 * `floor`, automations used `ceil`), which is exactly the kind of divergence a
 * shared helper prevents.
 *
 * It hosts TWO deliberately different bucket conventions. They are NOT
 * interchangeable and must not be unified — swapping one for the other silently
 * changes the point count:
 *
 * - {@link buildDenseBucketGrid} — **calendar-floor**. Buckets snap to the
 *   wall-clock interval grid, so a bucket is something a human can name ("the
 *   09:00 hour"). A 24h window at a 1h step spans 25 buckets, because the ragged
 *   window edges floor outward. Used by `users-overview` and
 *   `automations-overview`.
 * - {@link buildWindowRelativeSeries} — **window-relative**. The first bucket
 *   opens at `from` exactly and each next opens one step later, so the same 24h
 *   window yields exactly 24. Used by `buckets-overview`, whose response contract
 *   locks the point count to the period preset (24h → 24, 7d → 7, 30d → 30).
 *
 * Pick by what the caller's contract fixes: a nameable calendar bucket, or an
 * exact point count.
 *
 * Both conventions agree on everything else. A point is keyed by the ISO 8601
 * timestamp at the **start** of its bucket — matching the response contracts
 * ("ISO timestamp at the start of the bucket") and the standard charting
 * convention — and both are **dense**: every interval in the window is present,
 * empty ones carrying the caller's zero value, so chart libraries never have to
 * fill gaps.
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
 * Build a **window-relative** bucket grid of fixed length spanning `[from, to)`.
 *
 * Unlike {@link buildDenseBucketGrid}, buckets are NOT snapped to the wall-clock
 * interval grid: the first bucket opens at `from` exactly and each next bucket
 * opens one `stepMs` later. A 24h window at a 1h step therefore yields exactly
 * 24 points, where the floor-aligned grid spans 25. Callers whose response
 * contract locks the point count to the period preset (`24h → 24`, `7d → 7`,
 * `30d → 30`) need this convention; callers that want calendar-aligned buckets
 * ("the 09:00 hour") want the other one.
 *
 * Each point's `timestamp` is the bucket's **start** edge — the bucket covers
 * `[timestamp, timestamp + stepMs)`. Labelling by the end edge instead would put
 * every bar one full interval late and make the final bucket describe an
 * interval that has not happened yet.
 *
 * Rows before `from` are dropped (outside the window). Rows at or past `to` —
 * which a read issued after `to` was captured can legitimately return — fold
 * into the final bucket rather than being dropped, so a write that lands during
 * the request is still reported.
 */
export const buildWindowRelativeSeries = <R, V extends object>(options: {
  readonly rows: ReadonlyArray<R>
  readonly getTimestamp: (row: R) => Readonly<Date> | string | number
  readonly fromIso: string
  readonly toIso: string
  readonly stepMs: number
  readonly initial: V
  readonly accumulate: (acc: V, row: R) => V
}): ReadonlyArray<{ readonly timestamp: string } & V> => {
  const { rows, getTimestamp, fromIso, toIso, stepMs, initial, accumulate } = options
  const fromMs = new Date(fromIso).getTime()
  const count = Math.max(0, Math.round((new Date(toIso).getTime() - fromMs) / stepMs))
  const byIndex = rows.reduce<Readonly<Record<number, V>>>((acc, row) => {
    const ms = coerceTimestampToMs(getTimestamp(row))
    if (ms < fromMs || count === 0) return acc
    const index = Math.min(Math.floor((ms - fromMs) / stepMs), count - 1)
    return { ...acc, [index]: accumulate(acc[index] ?? initial, row) }
  }, {})
  return Array.from({ length: count }, (_unused, i) => ({
    timestamp: new Date(fromMs + i * stepMs).toISOString(),
    ...(byIndex[i] ?? initial),
  }))
}

/**
 * Build a **dense**, floor-aligned bucket grid spanning `[from, to]`.
 *
 * Every bucket from `floor(from)` to `floor(to)` inclusive is present (an
 * `n`-step window yields `n + 1` points). Buckets absent from `rowsByBucket`
 * carry `emptyValue`. Each point is `{ timestamp, ...value }`, where
 * `timestamp` is the ISO bucket-start key.
 *
 * Buckets snap to the wall-clock grid, so a caller whose contract fixes the
 * point count to the period preset wants {@link buildWindowRelativeSeries}
 * instead — that `n + 1` is one more than such a contract allows. This builder
 * also takes rows PRE-FOLDED (via {@link bucketRowsByTimestamp}), where the
 * window-relative one folds them itself.
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
