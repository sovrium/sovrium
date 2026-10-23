/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The window `chartAggregate.fillEmpty` draws every bucket of.
 *
 * A chart filtered by a relative range on its grouping field (`received_at
 * gte $now-24h`) fills the buckets of that range up to the current one: 24
 * hourly buckets ending with the hour holding "now". Only the fixed-length
 * intervals have a window — a minute, an hour, a day — since a month or a year
 * has no fixed length to step by. Pure: "now" is an argument.
 */

import { MAX_AGGREGATE_GROUPS } from '@/domain/models/api/tables/aggregate'
import { instantTokenOffsetMs, utcMinuteInstant } from '../../../relative-date-filter'

/** The most buckets one aggregate read returns, and so the most a chart can fill. */
export const FILL_BUCKET_CEILING = MAX_AGGREGATE_GROUPS

/** The length of each fixed-length interval, in milliseconds. */
export const FILL_STEP_MS: Readonly<Record<string, number>> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
}

/** The relative range a chart's filter names on its grouping field, as written. */
export interface FillRange {
  /** The token, `$now-24h`. */
  readonly token: string
  readonly spanMs: number
}

/**
 * The range a filter's `gte` / `gt` condition on `groupBy` names relative to
 * now, or `undefined` when it names none.
 */
export function relativeFillRange(filter: unknown, groupBy: string): FillRange | undefined {
  if (!Array.isArray(filter)) return undefined
  return filter.flatMap((condition: unknown): readonly FillRange[] => {
    const { field, operator, value } = (condition ?? {}) as Readonly<Record<string, unknown>>
    if (field !== groupBy || (operator !== 'gte' && operator !== 'gt')) return []
    // Read through the filter grammar's own reader: only a range reaching back
    // from now (`$now-24h`) has a span to fill.
    const offset = typeof value === 'string' ? instantTokenOffsetMs(value) : undefined
    return offset === undefined || offset >= 0 ? [] : [{ token: value as string, spanMs: -offset }]
  })[0]
}

/** How many buckets of `stepMs` a range of `spanMs` holds. */
export const fillBucketCount = (spanMs: number, stepMs: number): number =>
  Math.max(1, Math.ceil(spanMs / stepMs))

/** The first and the last bucket of a window, each keyed by its first instant. */
export interface FillWindow {
  readonly from: string
  readonly to: string
}

/**
 * The window of a range at `now`: the bucket holding `now` is the last, and
 * the window holds as many buckets as the range spans.
 */
export function fillWindowAt(now: Readonly<Date>, spanMs: number, stepMs: number): FillWindow {
  const last = Math.floor(now.getTime() / stepMs) * stepMs
  const first = last - (fillBucketCount(spanMs, stepMs) - 1) * stepMs
  return { from: new Date(first).toISOString(), to: new Date(last).toISOString() }
}

/**
 * The window a chart declaring `fillEmpty` fills at `now`, or `undefined` when
 * it does not fill, steps by no fixed length, or names no relative range.
 */
export function chartFillWindow(
  chart: {
    readonly chartAggregate?: {
      readonly groupBy: string
      readonly interval?: string
      readonly fillEmpty?: boolean
    }
    readonly dataSource?: unknown
  },
  now: Readonly<Date>
): FillWindow | undefined {
  const aggregate = chart.chartAggregate
  if (aggregate?.fillEmpty !== true || aggregate.interval === undefined) return undefined
  const stepMs = FILL_STEP_MS[aggregate.interval]
  const filter = (chart.dataSource as { readonly filter?: unknown } | undefined)?.filter
  const spanMs =
    relativeFillRange(filter, aggregate.groupBy)?.spanMs ??
    resolvedFillSpan(filter, aggregate.groupBy, now)
  if (stepMs === undefined || spanMs === undefined) return undefined
  return fillWindowAt(now, spanMs, stepMs)
}

/**
 * The span from a filter's lower bound on `groupBy` to `now`, when the bound
 * is an instant — a `$now-24h` the render already resolved — or `undefined`.
 *
 * Measured from `now` rounded down to its minute, as the render resolved the
 * token: from the raw clock, a `$now-24h` read at 15:30:30 would span 24 h
 * 30 s and fill one hourly bucket more than the same token unresolved.
 */
function resolvedFillSpan(
  filter: unknown,
  groupBy: string,
  now: Readonly<Date>
): number | undefined {
  if (!Array.isArray(filter)) return undefined
  const minute = Date.parse(utcMinuteInstant(now))
  const bounds = filter.flatMap((condition: unknown): readonly number[] => {
    const { field, operator, value } = (condition ?? {}) as Readonly<Record<string, unknown>>
    if (field !== groupBy || (operator !== 'gte' && operator !== 'gt')) return []
    const at = typeof value === 'string' && value.includes('T') ? Date.parse(value) : Number.NaN
    return Number.isFinite(at) && at < minute ? [minute - at] : []
  })
  return bounds[0]
}
