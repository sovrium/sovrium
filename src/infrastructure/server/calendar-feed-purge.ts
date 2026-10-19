/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { purgeCalendarFeedAddresses } from '@/application/use-cases/tables/calendar-feed'
import { CalendarFeedTokenRepositoryLive } from '@/infrastructure/database/repositories/tables/calendar-feed-token-repository-live'
import { logError, logInfo } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'

/**
 * Delete the feed addresses of every table the applied config no longer
 * publishes. Run on every config apply — each boot, and each `--watch` reload
 * that swaps the handler in place.
 *
 * Best-effort: a failure is logged with its cause and the apply goes on. The
 * addresses it would have deleted already answer 404 — the feed route reads
 * the CURRENT config and refuses a table without `calendarFeed` — so a missed
 * purge leaves dead rows, never a readable feed; the next apply retries.
 */
export const purgeStaleCalendarFeedAddresses = (app: App): Effect.Effect<void, never> =>
  purgeCalendarFeedAddresses(app).pipe(
    Effect.provide(CalendarFeedTokenRepositoryLive),
    Effect.tap((deleted) =>
      deleted > 0
        ? Effect.sync(() =>
            logInfo(`[calendar-feed] deleted ${deleted} unpublished feed address(es)`)
          )
        : Effect.void
    ),
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[calendar-feed] feed address purge failed', cause))
    ),
    // effect-swallow: see the doc comment — a dead address already answers 404, so the apply must not fail on it.
    Effect.ignore,
    Effect.withSpan('calendar-feed.purge-stale-addresses')
  )
