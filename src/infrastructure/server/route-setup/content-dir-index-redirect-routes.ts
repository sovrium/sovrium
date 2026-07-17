/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { deriveContentDirIndexBasePath } from '@/domain/utils/content-dir/content-dir-index-base-path'
import { resolvePagePath } from '@/domain/utils/content-dir/content-dir-seo-meta'
import { deriveContentDirSlugFromRouteParams } from '@/domain/utils/content-dir/content-dir-slug'
import { findMatchingRoute } from '@/domain/utils/matching/route-matcher'
import type { HonoAppConfig } from './page-routes'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

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
