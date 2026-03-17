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
  TopReferrer,
} from '../../ports/repositories/analytics-repository'

export interface QueryReferrersInput {
  readonly appName: string
  readonly from: Date
  readonly to: Date
}

export interface TopReferrersResult {
  readonly referrers: readonly TopReferrer[]
  readonly total: number
}

/**
 * Query top referrer domains ranked by page views.
 */
export const queryReferrers = (
  input: QueryReferrersInput
): Effect.Effect<TopReferrersResult, AnalyticsDatabaseError, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository

    const referrers = yield* repo.getTopReferrers({
      appName: input.appName,
      from: input.from,
      to: input.to,
      granularity: 'day',
    })

    return { referrers, total: referrers.length }
  })
