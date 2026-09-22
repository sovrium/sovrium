/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Server-mode 301 redirect for `contentDir.index` slugged URLs
 *.
 *
 * When a collection declares `index: '<slug>'`, the index article is the single
 * canonical URL at the collection BASE PATH (`/docs/:slug` → `/docs`). This
 * route permanently redirects the article's SLUGGED URL (`/docs/introduction`)
 * to that base path so old links keep working while search engines see one URL.
 *
 * SERVER MODE ONLY (by construction — this is a live Hono route): the static
 * build (`sovrium build`) instead emits the index article HTML AT the base path
 * and omits the slugged HTML, because a static host cannot emit a 301.
 *
 * Registered AFTER the per-page `.md` export route and BEFORE the language +
 * dynamic-page catch-all: the `.md`/`Accept: text/markdown` twins of the index
 * article keep serving raw markdown (200) — only the HTML slugged URL 301s.
 * Skipped entirely (no handler mounted) when no page declares `contentDir.index`.
 */

import { findMatchingRoute } from '@/domain/kernel/matching/route-matcher'
import { deriveContentDirIndexBasePath } from '@/domain/models/app/pages/content-dir-index-base-path'
import { resolvePagePath } from '@/domain/models/app/pages/content-dir-seo-meta'
import { deriveContentDirSlugFromRouteParams } from '@/domain/models/app/pages/content-dir-slug'
import type { HonoAppConfig } from '../../../application/ports/contracts/hono-app-config'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/**
 * Resolve the base-path redirect target for a request that hits an index
 * article's slugged URL. Returns `undefined` for any other path so the caller
 * falls through.
 */
const resolveContentDirIndexRedirect = (app: App, path: string): string | undefined => {
  const pages = app.pages ?? []
  const match = findMatchingRoute(
    pages.map((page) => page.path),
    path
  )
  if (match === undefined) return undefined
  const page = pages[match.index]
  if (page === undefined) return undefined
  const { contentDir } = page
  if (contentDir?.index === undefined) return undefined
  const slug = deriveContentDirSlugFromRouteParams(contentDir, match.params)
  if (slug !== contentDir.index) return undefined
  const basePathPattern = deriveContentDirIndexBasePath(page.path)
  if (basePathPattern === undefined) return undefined
  return resolvePagePath(basePathPattern, match.params)
}

/**
 * Setup the server-mode `contentDir.index` slug → base-path 301 redirect route.
 */
export function setupContentDirIndexRedirectRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  const { app } = config
  const pages = app.pages ?? []
  if (!pages.some((page) => page.contentDir?.index !== undefined)) return honoApp

  return honoApp.get('*', (c, next) => {
    const target = resolveContentDirIndexRedirect(app, c.req.path)
    if (target === undefined) return next()
    return c.redirect(target, 301)
  })
}
