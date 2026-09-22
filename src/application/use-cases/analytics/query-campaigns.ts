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
  CampaignEntry,
} from '../../ports/repositories/analytics/analytics-repository'

/**
 * Input for `queryCampaigns`.
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
export type QueryCampaignsInput = Omit<AnalyticsQueryParams, 'granularity'>

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
      ...input,
      // Pinned: this reader has no time buckets, but the repository param
      // type requires the field.
      granularity: 'day',
    })

    return { campaigns, total: campaigns.length }
  }).pipe(Effect.withSpan('analytics.query-campaigns'))
