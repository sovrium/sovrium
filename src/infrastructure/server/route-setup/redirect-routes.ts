/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Mount the `app.redirects` table as a live Hono route.
 *
 * MOUNT ORDER is the whole design, and it is load-bearing in both directions:
 *
 * - AFTER the public-directory route, so a real shipped file always wins. A
 *   redirect rule can never hijack `/install`, whose `curl … | sh` one-liner is
 *   a product's primary install path. The public-dir handler `next()`s when the
 *   file is absent, so this route still sees every unclaimed path.
 * - BEFORE the page routes, so a retired path answers its redirect instead of
 *   being swallowed by the dynamic-page catch-all's 404 — which would leave the
 *   rule silently dead.
 *
 * Falls through (`next()`) for every path the table does not declare, so the
 * redirect block answers only what it names and never becomes a catch-all.
 * Skipped entirely (no handler mounted) when the app declares no redirects.
 */

import { resolveRedirect } from '@/domain/utils/matching/redirect-matcher'
import { requestSearch } from '@/infrastructure/server/request-search'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/**
 * Setup the `app.redirects` routing.
 *
 * @param honoApp - Hono application instance.
 * @param app - Decoded app configuration.
 * @returns The Hono app with the redirect route chained (or unchanged).
 */
export function setupRedirectRoutes(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  const rules = app.redirects
  if (rules === undefined || rules.length === 0) return honoApp

  const languageCodes = app.languages?.supported.map((language) => language.code) ?? []

  return honoApp.get('*', (c, next) => {
    // The target must carry exactly the string the visitor arrived with — see
    // `requestSearch` for why the parsed params are not usable here.
    const resolution = resolveRedirect(rules, languageCodes, c.req.path, requestSearch(c))
    if (resolution === undefined) return next()

    return c.redirect(resolution.location, resolution.status)
  })
}
