/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SearchReadablePages } from '@/application/use-cases/page-search-corpus'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { resolvePageReader, type PageReaderResolver } from '@/presentation/api/search/page-reader'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * `GET /api/search/pages?q=` — the pages THIS reader may open that match the
 * query. It answers a `search-input` declared with
 * `scope: page` and `index: session`, per debounced keystroke.
 *
 * A visitor with no session gets the public pages; a signed-in reader
 * additionally gets every gated page and `contentDir` article their role may
 * open — filtered by the check the router applies when they visit it. A page
 * the reader may not open is simply absent: never a 403, which would confirm it
 * exists.
 *
 * The static `/sovrium-search/index.json` is untouched and stays public-only.
 */

/** Same selectivity floor as the palette: below it the answer is `200 []`. */
const MIN_QUERY_LENGTH = 2

/**
 * `private`: the answer depends on who asks, so a shared cache must not keep
 * it. `max-age=10` absorbs the re-issues typing produces, as on the palette.
 * `Vary: Cookie` keeps the browser's own cache from answering the next reader
 * of the same browser — a sign-out or a sign-in changes the cookie, and with it
 * which pages may be found.
 */
const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=10', Vary: 'Cookie' } as const

const buildPageSearchHandler =
  (app: App, getSession: PageReaderResolver | undefined) =>
  async (c: Context): Promise<Response> => {
    const query = (c.req.query('q') ?? '').trim()
    if (query.length < MIN_QUERY_LENGTH) {
      return c.json([], 200, CACHE_HEADERS)
    }
    const reader = await resolvePageReader(c, app, getSession)
    const hits = await runRequestEffect(
      c,
      provideDomain(c, SearchReadablePages(app, query, reader))
    )
    return c.json(hits, 200, CACHE_HEADERS)
  }

/** Chain `GET /api/search/pages` onto a Hono app. */
export function chainPageSearchRoutes<T extends Hono>(
  honoApp: T,
  app: App,
  getSession: PageReaderResolver | undefined
): T {
  return honoApp.get('/api/search/pages', buildPageSearchHandler(app, getSession)) as T
}
