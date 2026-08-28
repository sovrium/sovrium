/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
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

    return { summary, timeSeries }
  })
