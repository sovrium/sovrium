/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Deriving a catalog entry's operational state.
 *
 * `resolveLinkState` — the same function the redirect handler uses — decides
 * every state but one, and it is never re-implemented here: a console reporting
 * `active` for a link whose visitors get a 410 is the specific defect that rule
 * exists to prevent. The single value this module adds is `archived`, which
 * short-circuits, because a soft-deleted link has no lifecycle question left to
 * answer.
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import { resolveLinkState } from '@/domain/models/app/links/link-resolver'
import type { CatalogEntry, CatalogState } from './catalog'

/**
 * How many clicks this link has already been credited with.
 *
 * Counted over `system.analytics_events`, the ONE place a click is written, so
 * a console's `exhausted` badge and the redirect handler's refusal are reading
 * the same number. Returns 0 when the store is unreadable — an unenforceable cap
 * must not become a state the operator cannot explain.
 */
export const countLinkClicks = (
  appName: string,
  slug: string
): Effect.Effect<number, never, AnalyticsRepository> =>
  Effect.gen(function* () {
    const repository = yield* AnalyticsRepository
    const result = yield* repository.listEvents({
      appName,
      eventType: 'link_click',
      eventName: slug,
      limit: 1,
    })
    return result.pagination.total
  }).pipe(
    // effect-swallow: a click count is a column in an admin list, not a gate. An unreadable analytics store shows 0 there; the redirect path makes the same trade for the same reason (`link-routes.ts`).
    Effect.orElseSucceed(() => 0),
    Effect.withSpan('links.count-clicks')
  )

/**
 * The entry's operational state.
 *
 * The click count is read ONLY when the link declares a cap: without one the
 * number cannot change the answer, and `GET /api/admin/links` resolves a state
 * for every candidate in the catalog rather than only the page it returns.
 *
 * That last sentence is also why this carries its own span. One per candidate
 * reads as a lot of spans — and it is exactly the picture a "why did the links
 * console take three seconds" question needs, because the answer is one capped
 * link's click count times the size of the catalog.
 */
export const resolveEntryState = (
  appName: string,
  entry: Readonly<CatalogEntry>,
  now: Readonly<Date>
): Effect.Effect<CatalogState, never, AnalyticsRepository> =>
  Effect.gen(function* () {
    if (entry.archived) return 'archived' as const
    const cap = entry.link.lifecycle?.maxClicks
    const clickCount = cap === undefined ? 0 : yield* countLinkClicks(appName, entry.slug)
    return resolveLinkState(entry.link, { now, clickCount })
  }).pipe(Effect.withSpan('links.resolve-entry-state', { attributes: { slug: entry.slug } }))
