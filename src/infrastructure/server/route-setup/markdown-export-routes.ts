/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { checkPageAccess } from '@/domain/services/pages/page-access-check'
import { matchContentDirIndexBasePath } from '@/domain/utils/content-dir/content-dir-index-match'
import { deriveContentDirSlugFromRouteParams } from '@/domain/utils/content-dir/content-dir-slug'
import { findMatchingRoute } from '@/domain/utils/matching/route-matcher'
import { readContentDirBodyForSlug } from '@/infrastructure/markdown/content-dir-enumerator'
import { validateLanguageSubdirectory } from '@/infrastructure/server/language-detection'
import type { HonoAppConfig } from './page-routes'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'
import type { Hono } from 'hono'

const MD_SUFFIX = '.md'

interface ContentDirArticleMatch {
  readonly page: Page
  readonly contentDir: ContentDir
  readonly slug: string
}

const acceptsMarkdown = (accept: string): boolean =>
  accept
    .toLowerCase()
    .split(',')
    .some((part) => part.split(';')[0]?.trim() === 'text/markdown')

const matchContentDirArticle = (app: App, path: string): ContentDirArticleMatch | undefined => {
  const pages = app.pages ?? []
  const match = findMatchingRoute(
    pages.map((page) => page.path),
    path
  )
  if (match !== undefined) {
    const page = pages[match.index]
    const slug =
      page?.contentDir !== undefined
        ? deriveContentDirSlugFromRouteParams(page.contentDir, match.params)
        : undefined
    if (page?.contentDir !== undefined && slug !== undefined) {
      return { page, contentDir: page.contentDir, slug }
    }
  }
  const indexMatch = matchContentDirIndexBasePath(pages, path)
  if (indexMatch?.page.contentDir !== undefined) {
    return {
      page: indexMatch.page,
      contentDir: indexMatch.page.contentDir,
      slug: indexMatch.indexSlug,
    }
  }
  return undefined
}

const findContentDirArticle = (
  app: App,
  articlePath: string
): ContentDirArticleMatch | undefined => {
  const direct = matchContentDirArticle(app, articlePath)
  if (direct !== undefined) return direct
  const lang = validateLanguageSubdirectory(app, articlePath)
  if (lang === undefined) return undefined
  const stripped = articlePath.slice(`/${lang}`.length) || '/'
  return matchContentDirArticle(app, stripped)
}

export function setupMarkdownExportRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  const { app } = config
  const pages = app.pages ?? []
  if (!pages.some((page) => page.contentDir !== undefined)) return honoApp

  return honoApp.get('*', async (c, next) => {
    const rawPath = c.req.path
    const byExtension = rawPath.endsWith(MD_SUFFIX)
    const byAccept = acceptsMarkdown(c.req.header('Accept') ?? '')
    if (!byExtension && !byAccept) return next()

    const articlePath = byExtension ? rawPath.slice(0, -MD_SUFFIX.length) : rawPath
    const match = findContentDirArticle(app, articlePath)
    if (match === undefined) return next()

    const session = config.getSession ? await config.getSession(c.req.raw.headers) : undefined
    if (!checkPageAccess(match.page.access, app, session, articlePath).allowed) {
      return c.html(await config.renderNotFoundPage(app), 404)
    }

    const body = await readContentDirBodyForSlug(match.contentDir, match.slug)
    if (body === undefined) {
      return c.html(await config.renderNotFoundPage(app), 404)
    }

    return c.body(body, 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    })
  })
}
