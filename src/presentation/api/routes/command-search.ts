/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { SearchCommandPalette } from '@/application/use-cases/command-search'
import { provideCommandSearchLive } from '@/presentation/api/routes/command-search/effect-runner'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'


const buildSearchHandler =
  (app: App) =>
  async (c: Context): Promise<Response> => {
    const session = getSessionContext(c)
    const query = (c.req.query('q') ?? '').trim()
    if (query.length === 0) return c.json([], 200)

    const results = await Effect.runPromise(
      SearchCommandPalette(app, query, session?.userId).pipe(provideCommandSearchLive)
    )

    return c.json(results, 200)
  }

export function chainCommandSearchRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp.get('/api/command-search', buildSearchHandler(app)) as T
}
