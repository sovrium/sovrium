/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const HOUR_MS = 60 * 60 * 1000

export const DAY_MS = 24 * HOUR_MS

export const intervalStepMs = (interval: '1h' | '1d'): number =>
  interval === '1h' ? HOUR_MS : DAY_MS

export const coerceTimestampToMs = (value: Readonly<Date> | string | number): number => {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return new Date(value).getTime()
}

export const bucketKeyForMs = (ms: number, stepMs: number): string =>
  new Date(Math.floor(ms / stepMs) * stepMs).toISOString()

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
