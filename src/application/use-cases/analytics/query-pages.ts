/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '../../ports/repositories/analytics/analytics-repository'
import type {
  AnalyticsDatabaseError,
  TopPage,
} from '../../ports/repositories/analytics/analytics-repository'

export interface QueryPagesInput {
  readonly appName: string
  readonly from: Date
  readonly to: Date
}

export interface TopPagesResult {
  readonly pages: readonly TopPage[]
  readonly total: number
}

export const queryPages = (
  input: QueryPagesInput
): Effect.Effect<TopPagesResult, AnalyticsDatabaseError, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AnalyticsRepository

    const pages = yield* repo.getTopPages({
      appName: input.appName,
      from: input.from,
      to: input.to,
      granularity: 'day',
    })

    return { pages, total: pages.length }
  })
