/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { minimiseEvent } from '@/domain/models/app/analytics/analytics-profile-service'
import { AnalyticsRepository } from '../../ports/repositories/analytics/analytics-repository'
import type {
  AnalyticsDatabaseError,
  MinimisedEventWrite,
} from '../../ports/repositories/analytics/analytics-repository'

/** Rows read per round trip. */
const PAGE_SIZE = 500

/**
 * Strip from an app's stored events every field the `audience-only` profile
 * excludes, keeping every row: page views and outbound clicks lose their query
 * strings and campaign, title, referrer and screen fields; short-link clicks,
 * QR scans and form submissions move to the shared visitor identifier.
 *
 * Run at start, only when the profile is `audience-only`. Idempotent: a row
 * rewritten once no longer matches, so a second run rewrites nothing. Deleting
 * nothing is what keeps a link's `maxClicks` and every reader's totals intact.
 *
 * @returns How many rows were rewritten
 */
export const minimiseStoredAnalyticsEvents = (
  appName: string
): Effect.Effect<number, AnalyticsDatabaseError, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repository = yield* AnalyticsRepository

    const sweepFrom = (
      afterId: string | undefined,
      rewritten: number
    ): Effect.Effect<number, AnalyticsDatabaseError> =>
      Effect.gen(function* () {
        const rows = yield* repository.listUnminimisedEvents({ appName, afterId, limit: PAGE_SIZE })
        const writes: readonly MinimisedEventWrite[] = rows.flatMap((row) => {
          const minimised = minimiseEvent(row)
          return minimised === undefined ? [] : [{ ...minimised, id: row.id }]
        })
        yield* Effect.forEach(writes, (write) => repository.rewriteEvent(write), { discard: true })
        const total = rewritten + writes.length
        const last = rows.at(-1)
        if (rows.length < PAGE_SIZE || last === undefined) return total
        return yield* sweepFrom(last.id, total)
      })

    return yield* sweepFrom(undefined, 0)
  }).pipe(Effect.withSpan('analytics.minimise-stored-analytics-events'))
