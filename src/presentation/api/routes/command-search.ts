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
 * Build the GET /api/command-search handler bound to the resolved app schema.
 */
const buildSearchHandler =
  (app: App) =>
  async (c: Context): Promise<Response> => {
    const session = getSessionContext(c)
    const query = (c.req.query('q') ?? '').trim()
    if (query.length === 0) return c.json([], 200)

    const results = await runRequestEffect(
      c,
      SearchCommandPalette(app, query, session?.userId).pipe(provideCommandSearchLive)
    )

    return c.json(results, 200)
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
