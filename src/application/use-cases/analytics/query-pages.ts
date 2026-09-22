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
  TopPage,
} from '../../ports/repositories/analytics/analytics-repository'

/**
 * Input for `queryPages`.
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
export type QueryPagesInput = Omit<AnalyticsQueryParams, 'granularity'>

export interface TopPagesResult {
  readonly pages: readonly TopPage[]
  readonly total: number
}

/**
 * Query top pages ranked by page views.
 */
export const queryPages = (
  input: QueryPagesInput
): Effect.Effect<TopPagesResult, AnalyticsDatabaseError, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository

    const pages = yield* repo.getTopPages({
      ...input,
      // Pinned: this reader has no time buckets, but the repository param
      // type requires the field.
      granularity: 'day',
    })

    return { pages, total: pages.length }
  }).pipe(Effect.withSpan('analytics.query-pages'))
