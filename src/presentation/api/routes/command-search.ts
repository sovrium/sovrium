/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SearchCommandPalette } from '@/application/use-cases/command-search'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideCommandSearchLive } from '@/presentation/api/routes/command-search/effect-runner'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Command Palette Search API.
 *
 *   - `GET /api/command-search?q=<query>` — cross-table record search for the
 *     global command palette. Matches the query (case-insensitive substring)
 *     against every table's text-typed columns and returns the matching rows
 *     as palette result options.
 *
 * Results are ranked so that records the caller has favorited sort above
 * non-favorited records. Each result carries a `favorited` boolean so the
 * palette can render a star indicator next to favorited entries.
 *
 * Data access (the favorites load, the per-table text search) lives in the
 * `command-search` use case + repository; this handler keeps only HTTP, auth,
 * and query validation, then calls the use case via the effect runner.
 */

/**
 * Minimum length of the TRIMMED query before the endpoint will run the scan
 *.
 *
 * A single character is the worst input this endpoint accepts: `%a%` selects a
 * large fraction of every text column on every table, the database materializes
 * all of it, and the use case then discards everything past the first 25 rows —
 * and a palette fires exactly that on the first keystroke of every search anyone
 * ever performs. `%ab%` is already ~26x more selective, so the second character
 * buys nearly all of the benefit; a floor of 3 would make two-letter searches
 * unreachable for no measured gain.
 */
const MIN_QUERY_LENGTH = 2

/**
 * Cache directive on every 200. Both halves are load-bearing:
 *
 *   `private`    results are session-dependent — the `favorited` boost reads the
 *                caller's own favorites — so a shared cache MUST NOT store them.
 *                Omitting it would let a proxy serve one reader's favorite
 *                ordering to another.
 *   `max-age=10` long enough to absorb the re-issues a palette generates by its
 *                normal operation (backspace-and-retype, reopening, a re-mount),
 *                short enough that a record created seconds ago is discoverable.
 *
 * Empty results carry it too: an empty answer is the response a fast typist
 * generates most often, so caching only the hits would miss most of the traffic
 * that actually costs a scan.
 */
const CACHE_CONTROL = 'private, max-age=10'

/**
 * Build the GET /api/command-search handler bound to the resolved app schema.
 */
const buildSearchHandler =
  (app: App) =>
  async (c: Context): Promise<Response> => {
    const session = getSessionContext(c)
    const query = (c.req.query('q') ?? '').trim()
    // Below the selectivity floor the honest answer is `200 []`, NOT `400`: a
    // palette types into this endpoint character by character, and a 400
    // mid-typing is an error state rendered for a user who has done nothing
    // wrong. This also covers the empty-query case it replaces.
    if (query.length < MIN_QUERY_LENGTH) {
      return c.json([], 200, { 'Cache-Control': CACHE_CONTROL })
    }

    const results = await runRequestEffect(
      c,
      SearchCommandPalette(app, query, session?.userId).pipe(provideCommandSearchLive)
    )

    return c.json(results, 200, { 'Cache-Control': CACHE_CONTROL })
  }

/**
 * Chain the command-palette search route onto a Hono app.
 *
 * **Authentication**: `authMiddleware` is applied to `/api/command-search` in
 * `api-routes.ts` when `app.auth` is configured so the favorited-boost ranking
 * can resolve the caller. The route works without a session too — it simply
 * returns all matches with `favorited: false`.
 */
export function chainCommandSearchRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp.get('/api/command-search', buildSearchHandler(app)) as T
}
