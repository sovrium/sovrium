/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '../../ports/repositories/analytics-repository'
import type {
  AnalyticsDatabaseError,
  AnalyticsSummary,
  TimeSeriesPoint,
} from '../../ports/repositories/analytics-repository'

export interface QueryOverviewInput {
  readonly appName: string
  readonly from: Date
  readonly to: Date
  readonly granularity: 'hour' | 'day' | 'week' | 'month'
}

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

    const params = {
      appName: input.appName,
      from: input.from,
      to: input.to,
      granularity: input.granularity,
    }

    const [summary, timeSeries] = yield* Effect.all([
      repo.getSummary(params),
      repo.getTimeSeries(params),
    ])

    return { summary, timeSeries }
  })
