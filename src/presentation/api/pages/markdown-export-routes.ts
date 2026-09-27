/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-page Markdown content-negotiation.
 *
 * Every contentDir/docs article is AUTOMATICALLY served as raw Markdown at its
 * `<article-url>.md` twin — the per-page counterpart of the whole-site
 * `/llms-full.txt` surface, with NO opt-in config property. The optional
 * `Accept: text/markdown` secondary form serves the same raw body from the
 * canonical article URL.
 *
 * Honest default: the served `.md` body is the article's markdown with its YAML
 * frontmatter STRIPPED (starts at the `# H1`), matching how `/llms-full.txt`
 * concatenates frontmatter-stripped bodies — a human or agent grabbing the page
 * gets clean content, not YAML metadata.
 *
 * Access posture (S1): the `.md` surface exposes exactly the content the article
 * URL does; it inherits the article's page-level access. A page-access-restricted
 * article's `.md` therefore 404s for unauthorized callers (anti-enumeration),
 * and an unknown slug within an existing collection is a genuine 404.
 *
 * Registered BEFORE the language routes and the dynamic-page catch-all (a `.md`
 * path matches no page pattern and would otherwise 404 through the catch-all),
 * and AFTER the static-asset middleware (which falls through on a miss) so a
 * same-named public file still wins.
 */

import { Effect } from 'effect'
import { ContentDirReader } from '@/application/ports/services/content-dir-reader'
import { findMatchingRoute } from '@/domain/kernel/matching/route-matcher'
import { validateLanguageSubdirectory } from '@/domain/models/app/languages/language-detection'
import { matchContentDirIndexBasePath } from '@/domain/models/app/pages/content-dir-index-match'
import { deriveContentDirSlugFromRouteParams } from '@/domain/models/app/pages/content-dir-slug'
import { isPublicPage } from '@/domain/models/app/pages/is-public'
import { checkPageAccess } from '@/domain/models/app/pages/page-access-check'
import { isNoindexPage } from '@/domain/models/app/pages/sitemap-builder'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { varyOnAccept } from '@/presentation/api/runtime/vary'
import { PRIVATE_CACHE_CONTROL } from './page-cache-decision'
import type { HonoAppConfig } from '../../../application/ports/contracts/hono-app-config'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'
import type { Context, Hono, Next } from 'hono'

/** The suffix that flags a per-page raw-markdown export request. */
const MD_SUFFIX = '.md'

/** A matched contentDir article: the page, its contentDir, and the resolved slug. */
interface ContentDirArticleMatch {
  readonly page: Page
  readonly contentDir: ContentDir
  readonly slug: string
}

/**
 * `true` when the `Accept` header EXPLICITLY lists `text/markdown` as an
 * acceptable media type. A wildcard accept and `text/html` do NOT match, so
 * ordinary browser requests are never diverted from the HTML article — only a
 * caller that deliberately asks for Markdown gets the raw body.
 */
const acceptsMarkdown = (accept: string): boolean =>
  accept
    .toLowerCase()
    .split(',')
    .some((part) => part.split(';')[0]?.trim() === 'text/markdown')

/**
 * Match `articlePath` against the app's page patterns and, when the matched
 * page declares a `contentDir`, resolve the slug it maps to. Returns `undefined`
 * for a non-contentDir match (or no match) so the caller falls through.
 */
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
  // [internal ref]: the collection BASE PATH serves the `contentDir.index` article, so
  // its `<basePath>.md` / `Accept: text/markdown` twins serve the index body.
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

/**
 * Resolve the contentDir article behind an `.md`/`Accept`-negotiated request,
 * trying the direct path first and then the language-stripped path so a
 * bilingual `/{lang}/docs/:slug.md` route resolves against a `/docs/:slug` page.
 */
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

/**
 * Headers of a Markdown response.
 *
 * `X-Robots-Tag: noindex` when the article's page is withheld from search: a
 * Markdown body has nowhere to carry the `noindex` meta tag, so the twin of a
 * withheld page would otherwise be indexable. `Vary: Accept` is not set here:
 * a record entry REPLACES the header, so it is appended through
 * {@link varyOnAccept} instead, which keeps whatever `Vary` another layer
 * already declared.
 */
/** Cache policy of a public article's Markdown: shareable for five minutes. */
const PUBLIC_MARKDOWN_CACHE_CONTROL = 'public, max-age=300'

const markdownResponseHeaders = (page: Page): Record<string, string> => ({
  'Content-Type': 'text/markdown; charset=utf-8',
  // A page restricted by `access` answers each session with its own Markdown,
  // exactly as its HTML does, so it carries the HTML's private policy: a
  // shared cache must never store it and hand it to the next caller.
  'Cache-Control': isPublicPage(page) ? PUBLIC_MARKDOWN_CACHE_CONTROL : PRIVATE_CACHE_CONTROL,
  ...(isNoindexPage(page) ? { 'X-Robots-Tag': 'noindex' } : {}),
})

/**
 * Let an HTML request through, then mark its response `Vary: Accept` when the
 * URL is a negotiable article address — one that also answers Markdown to
 * `Accept: text/markdown`. Without it a cache or CDN in front of the app may
 * hand the Markdown to a browser, or the HTML to an agent.
 */
const answerHtmlVaryingOnAccept = async (
  c: Context,
  next: Next,
  app: App,
  path: string
): Promise<void> => {
  await next()
  if (findContentDirArticle(app, path) !== undefined) varyOnAccept(c)
}

/**
 * Setup the per-page Markdown export route.
 *
 * Mounts a single fall-through handler that serves raw Markdown for
 * `<article-url>.md` and for `Accept: text/markdown` requests on the canonical
 * article URL. Any request that is not a Markdown-export candidate — or resolves
 * to a non-contentDir page — is passed through untouched via `next()`.
 *
 * Skipped entirely (no handler mounted) when the app declares no contentDir
 * page, so non-docs apps pay nothing.
 */
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
    if (!byExtension && !byAccept) return answerHtmlVaryingOnAccept(c, next, app, rawPath)

    const articlePath = byExtension ? rawPath.slice(0, -MD_SUFFIX.length) : rawPath
    const match = findContentDirArticle(app, articlePath)
    if (match === undefined) return next()

    // S1: the `.md` twin inherits the article's page-level access. A denied
    // page 404s (anti-enumeration) instead of leaking the raw markdown.
    const session = config.getSession ? await config.getSession(c.req.raw.headers) : undefined
    if (!checkPageAccess(match.page.access, app, session, articlePath).allowed) {
      return c.html(await config.renderNotFoundPage(app), 404)
    }

    const body = await runDomainPromise(
      c,
      Effect.gen(function* () {
        const reader = yield* ContentDirReader
        return yield* reader.readBodyForSlug(match.contentDir, match.slug)
      })
    )
    if (body === undefined) {
      // Slug genuinely absent from an existing collection → real 404
      // (consistent with the article path's collection-not-found contract).
      return c.html(await config.renderNotFoundPage(app), 404)
    }

    // The negotiated form shares its URL with the HTML; the `.md` address has
    // one representation and needs no `Vary`.
    if (!byExtension) varyOnAccept(c)
    return c.body(body, 200, markdownResponseHeaders(match.page))
  })
}
