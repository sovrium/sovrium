/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { fillMissingDays } from '@/domain/kernel/time/time-series-bucketing'
import { AnalyticsRepository } from '../../ports/repositories/analytics/analytics-repository'
import type {
  AnalyticsQueryParams,
  AnalyticsDatabaseError,
  AnalyticsSummary,
  TimeSeriesPoint,
} from '../../ports/repositories/analytics/analytics-repository'

/**
 * Input for `queryOverview`.
 *
 * The event-population fields (`eventType` / `eventName`) are carried by
 * SPREADING the repository's own param type rather than re-listing its fields.
 * That is the whole point: this reader family shipped with each hop hand-copying
 * `appName`/`from`/`to`, which silently dropped `?event_type=` between the
 * parser and the where-clause. The reader then answered a click-shaped question
 * with page-view totals — HTTP 200, a plausible number, the wrong population,
 * and nothing to fail on. A structural forward cannot drop the NEXT field added
 * here the same way.
 */
export type QueryOverviewInput = AnalyticsQueryParams

export interface OverviewResult {
  readonly summary: AnalyticsSummary
  readonly timeSeries: readonly TimeSeriesPoint[]
}

/**
 * A daily series with a point for every day of the window, so a trend over a
 * week with one active day reads as a line along zero rather than one dot. An
 * empty series stays empty (the reader's "nothing recorded" state); hourly,
 * weekly and monthly series are returned as grouped.
 */
const denseDailySeries = (
  input: QueryOverviewInput,
  points: readonly TimeSeriesPoint[]
): readonly TimeSeriesPoint[] =>
  input.granularity !== 'day'
    ? points
    : fillMissingDays({
        points,
        dayOf: (point) => point.period,
        fromIso: input.from.toISOString(),
        toIso: input.to.toISOString(),
        // Same key shape as the dialect's own (a bare day, or a day followed by its midnight and offset).
        emptyPoint: (day, like) => ({
          period: `${day}${like.period.slice(10)}`,
          pageViews: 0,
          uniqueVisitors: 0,
          sessions: 0,
        }),
      })

/**
 * Query analytics overview: summary metrics + time series data.
 */
export const queryOverview = (
  input: QueryOverviewInput
): Effect.Effect<OverviewResult, AnalyticsDatabaseError, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository

    const [summary, timeSeries] = yield* Effect.all([
      repo.getSummary(input),
      repo.getTimeSeries(input),
    ])

    return { summary, timeSeries: denseDailySeries(input, timeSeries) }
  }).pipe(Effect.withSpan('analytics.query-overview'))
