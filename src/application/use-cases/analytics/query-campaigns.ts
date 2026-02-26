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
  CampaignEntry,
} from '../../ports/repositories/analytics-repository'

export interface QueryCampaignsInput {
  readonly appName: string
  readonly from: Date
  readonly to: Date
}

export interface CampaignsResult {
  readonly campaigns: readonly CampaignEntry[]
  readonly total: number
}

/**
 * Query UTM campaign breakdown.
 */
export const queryCampaigns = (
  input: QueryCampaignsInput
): Effect.Effect<CampaignsResult, AnalyticsDatabaseError, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository

    const campaigns = yield* repo.getCampaigns({
      appName: input.appName,
      from: input.from,
      to: input.to,
      granularity: 'day',
    })

    const total = campaigns.reduce((sum, c) => sum + c.pageViews, 0)

    return { campaigns, total }
  })
