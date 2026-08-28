/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Context, type Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { buildRobotsTxt, buildSitemapXml } from '@/domain/services/feeds/sitemap-builder'
import { logError } from '@/infrastructure/logging/logger'
import {
  detectLanguageIfEnabled,
  validateLanguageSubdirectory,
} from '@/infrastructure/server/language-detection'
import { varyOnAcceptLanguage } from '@/infrastructure/server/vary'
import { isProduction as isProductionEnv } from '@/infrastructure/utils/env'
import { setupAdminDashboardRoutes } from './admin-dashboard-routes'
import { setupContentDirIndexRedirectRoutes } from './content-dir-index-redirect-routes'
import { setupMarkdownExportRoutes } from './markdown-export-routes'
import {
  ERROR_PAGE_STATUS,
  extractSession,
  renderTracedPage,
  renderWithCache,
  resolvePreviewMode,
} from './page-render-pipeline'
import { setupUrlCanonicalizationRoutes } from './url-canonicalization-routes'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/types/session-info'

/**
 * Hono app configuration for route setup
 */
export interface HonoAppConfig {
  readonly app: App
  readonly publicDir?: string
  readonly renderPage: (
    app: App,
    path: string,
    requestContext?: {
      readonly detectedLanguage?: string
      readonly session?: SessionInfo
      readonly cookies?: Readonly<Record<string, string>>
      readonly previewMode?: boolean
      readonly requestQuery?: Readonly<Record<string, string>>
      readonly urlLanguage?: string
    }
  ) => PageRenderResult | Promise<PageRenderResult>
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  /**
   * RSS feed renderer ([internal ref] — [internal ref]).
   *
   * Returns the RSS 2.0 XML body for the first collection page that
   * declares `rss !== false`, or `undefined` when no such page exists
   * (the route handler responds 404). Optional so a caller that wires no
   * renderer gets a 404 by default rather than a runtime crash.
   */
  readonly renderRssFeed?: (app: App, baseUrl: string) => Promise<string | undefined>
  readonly getSession?: (headers: Headers) => Promise<SessionInfo | undefined>
}

/**
 * Setup homepage route
 */
export function setupHomepageRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app, renderErrorPage } = config

  return honoApp.get('/', async (c) => {
    try {
      const session = await extractSession(config, c.req.raw.headers)
      const cookies = getCookie(c)
      const previewMode = resolvePreviewMode(c, session)
      const reqCtx = { session, cookies, previewMode, requestQuery: c.req.query() }

      if (!app.languages || app.languages.detectBrowser === false) {
        return (await renderTracedPage(c, config, '/', reqCtx)) ?? c.html('')
      }

      // [internal ref] — placed AFTER the guard above and BEFORE the
      // branch below so it covers BOTH outcomes. A monolingual app (or
      // `detectBrowser: false`) never reaches here and emits no `Vary`, which is
      // correct: neither of its branches reads the header.
      //
      // The 200 branch matters as much as the 302. It ships
      // `Cache-Control: public, max-age=300`, so a shared cache stores the
      // English `/` under the bare `/` key and serves it to a French visitor
      // whose redirect then never runs at all.
      varyOnAcceptLanguage(c)

      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      const targetLanguage = detectedLanguage || app.languages.default

      if (targetLanguage !== app.languages.default) {
        return c.redirect(`/${targetLanguage}/`, 302)
      }

      return (await renderTracedPage(c, config, '/', reqCtx)) ?? c.html('')
    } catch (error) {
      logError(`[SERVER] GET / → ${ERROR_PAGE_STATUS} Error rendering homepage`, error)
      return c.html(await renderErrorPage(app), ERROR_PAGE_STATUS)
    }
  })
}

/**
 * Handle the bare `/:lang` route (no trailing slash).
 *
 * [internal ref]: a language-prefixed root requested WITHOUT a trailing
 * slash (e.g. `/en`) permanently redirects (301) to its canonical
 * trailing-slash form (`/en/`), which is the surface the language homepage
 * route serves. This keeps a single canonical URL per language root for SEO
 * and avoids the language homepage being reachable under two distinct paths.
 *
 * [internal ref]: the redirect fires ONLY when the single path segment is a
 * configured app language. A non-language single segment (e.g. `/about`) is
 * passed through to the catch-all via `next()` so ordinary top-level pages are
 * untouched by the trailing-slash rule.
 */
function handleBareLanguageRoute(config: HonoAppConfig) {
  const { app } = config
  return async (c: Readonly<Context>, next: () => Promise<void>) => {
    const urlLanguage = validateLanguageSubdirectory(app, c.req.path)
    if (urlLanguage === undefined) {
      return next()
    }
    return c.redirect(`/${urlLanguage}/`, 301)
  }
}

/**
 * Handle /:lang/ route (homepage in specific language)
 */
function handleLanguageHomepageRoute(config: HonoAppConfig) {
  const { app, renderNotFoundPage, renderErrorPage } = config
  return async (c: Readonly<Context>) => {
    try {
      const { path } = c.req
      const session = await extractSession(config, c.req.raw.headers)
      const cookies = getCookie(c)
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      // On exact `/:lang/` matches, the URL prefix is authoritative for locale —
      // it must beat the browser Accept-Language so `/en/` never renders French,
      // and it is passed on as `urlLanguage` so it also beats a page's own
      // `meta.lang` ([internal ref]..039).
      const urlLanguage = validateLanguageSubdirectory(app, path)
      const base = {
        session,
        cookies,
        previewMode: resolvePreviewMode(c, session),
        requestQuery: c.req.query(),
        urlLanguage,
      }
      const exact = await renderWithCache(
        config,
        path,
        { ...base, detectedLanguage: urlLanguage ?? detectedLanguage },
        c
      )
      if (exact) return exact
      if (!urlLanguage) {
        return c.html(await renderNotFoundPage(app, detectedLanguage), 404)
      }
      const lang = await renderWithCache(config, '/', { ...base, detectedLanguage: urlLanguage }, c)
      return lang ?? c.html('')
    } catch (error) {
      logError(`[SERVER] GET ${c.req.path} → ${ERROR_PAGE_STATUS} Error rendering homepage`, error)
      const detectedLang = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      return c.html(await renderErrorPage(app, detectedLang), ERROR_PAGE_STATUS)
    }
  }
}

/**
 * Handle /:lang/* route (pages in specific language)
 */
function handleLanguagePageRoute(config: HonoAppConfig) {
  const { app, renderNotFoundPage, renderErrorPage } = config
  return async (c: Readonly<Context>) => {
    const { path } = c.req
    const session = await extractSession(config, c.req.raw.headers)
    const cookies = getCookie(c)
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    // On exact `/:lang/...` matches, the URL prefix is authoritative for locale —
    // it must beat the browser Accept-Language so `/en/...` never renders French,
    // and it is passed on as `urlLanguage` so it also beats a page's own
    // `meta.lang` ([internal ref]..039).
    const urlLanguage = validateLanguageSubdirectory(app, path)
    const base = {
      session,
      cookies,
      previewMode: resolvePreviewMode(c, session),
      requestQuery: c.req.query(),
      urlLanguage,
    }
    try {
      const exact = await renderWithCache(
        config,
        path,
        { ...base, detectedLanguage: urlLanguage ?? detectedLanguage },
        c
      )
      if (exact) return exact
      if (!urlLanguage) {
        return c.html(await renderNotFoundPage(app, detectedLanguage), 404)
      }
      const pathWithoutLang = path.replace(`/${urlLanguage}`, '') || '/'
      const lang = await renderWithCache(
        config,
        pathWithoutLang,
        { ...base, detectedLanguage: urlLanguage },
        c
      )
      return lang ?? c.html(await renderNotFoundPage(app, urlLanguage), 404)
    } catch (error) {
      logError(`[SERVER] GET ${path} → ${ERROR_PAGE_STATUS} Error rendering page`, error)
      return c.html(await renderErrorPage(app, detectedLanguage), ERROR_PAGE_STATUS)
    }
  }
}

/**
 * Setup language subdirectory routes
 */
export function setupLanguageRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  return honoApp
    .get('/:lang', handleBareLanguageRoute(config))
    .get('/:lang/', handleLanguageHomepageRoute(config))
    .get('/:lang/*', handleLanguagePageRoute(config))
}

/**
 * Setup dynamic page routes
 */
export function setupDynamicPageRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  const { app, renderNotFoundPage } = config

  return honoApp.get('*', async (c) => {
    const { path } = c.req
    const session = await extractSession(config, c.req.raw.headers)
    const cookies = getCookie(c)
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    const previewMode = resolvePreviewMode(c, session)
    const requestQuery = c.req.query()
    const response = await renderWithCache(
      config,
      path,
      { detectedLanguage, session, cookies, previewMode, requestQuery },
      c
    )
    return response ?? c.html(await renderNotFoundPage(app, detectedLanguage), 404)
  })
}

/**
 * Setup the `/feed.xml` RSS endpoint.
 *
 * Mounted BEFORE the dynamic-page catch-all (`*`) so the rss handler wins
 * the route match — the catch-all would otherwise treat `/feed.xml` as a
 * page path and 404 because no page declares that path.
 *
 * Behaviour:
 *   - When `config.renderRssFeed` is provided AND it returns an XML
 *     string, respond `200 application/rss+xml`.
 *   - When the renderer returns `undefined` (no opted-in collection page),
 *     fall through to a 404 rendered with the standard not-found page so
 *     the response stays consistent with other unmapped paths.
 *   - Errors are logged and surfaced as a 500 via the standard error page.
 */
export function setupRssFeedRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app, renderRssFeed, renderNotFoundPage, renderErrorPage } = config

  return honoApp.get('/feed.xml', async (c) => {
    if (!renderRssFeed) {
      return c.html(await renderNotFoundPage(app), 404)
    }
    try {
      const url = new URL(c.req.url)
      const baseUrl = `${url.protocol}//${url.host}`
      const xml = await renderRssFeed(app, baseUrl)
      if (xml === undefined) {
        return c.html(await renderNotFoundPage(app), 404)
      }
      return c.body(xml, 200, {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      })
    } catch (error) {
      logError(`[SERVER] GET /feed.xml → ${ERROR_PAGE_STATUS} Error rendering RSS feed`, error)
      return c.html(await renderErrorPage(app), ERROR_PAGE_STATUS)
    }
  })
}

/**
 * Setup the `/sitemap.xml` endpoint.
 *
 * Generates an XML sitemap from the app's pages, honouring each page's
 * per-page `sitemap` config (priority, changefreq, or `false` to exclude).
 *
 * Mounted BEFORE the language routes (`/:lang/*`) and the dynamic-page
 * catch-all (`*`) for the same reason as the RSS feed: `/:lang/*` would
 * otherwise match `/sitemap.xml` with `:lang = sitemap.xml`.
 */
export function setupSitemapRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app } = config

  return honoApp.get('/sitemap.xml', (c) => {
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}`
    // Clock injected at the boundary so the domain builder stays a pure
    // function of its inputs.
    const xml = buildSitemapXml(app.pages ?? [], baseUrl, new Date())
    return c.body(xml, 200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    })
  })
}

/**
 * Setup the `/robots.txt` endpoint ([internal ref] — [internal ref]).
 *
 * Auto-generates robots.txt with a reference to `/sitemap.xml`. Registered
 * before the language and catch-all routes for the same routing reason as
 * the sitemap endpoint.
 */
export function setupRobotsRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app } = config

  return honoApp.get('/robots.txt', (c) => {
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}`
    const body = buildRobotsTxt(app.pages ?? [], baseUrl)
    return c.body(body, 200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    })
  })
}

/**
 * Setup test error route
 */
export function setupTestErrorRoute(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  const { app, renderNotFoundPage } = config

  return honoApp.get('/test/error', (c) => {
    if (isProductionEnv()) {
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      return c.html(renderNotFoundPage(app, detectedLanguage), 404)
    }
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error('Test error')
  })
}

/**
 * Setup page routes (homepage, RSS feed, language subdirectories, dynamic pages)
 *
 * Order is significant — Hono dispatches in registration order and the
 * `/:lang/*` route from `setupLanguageRoutes` matches `/feed.xml` (with
 * `:lang = feed.xml`, `* = empty`). `setupRssFeedRoute` therefore has to
 * be registered BEFORE language routes (and before the catch-all `*` in
 * `setupDynamicPageRoutes`) so the RSS handler wins the match.
 */
export function setupPageRoutes(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  return setupDynamicPageRoutes(
    setupLanguageRoutes(
      // [internal ref]: trailing-slash normalization + the unprefixed-path language
      // fallback. Registered AFTER the `contentDir.index` 301 (whose shipped
      // placement is the precedent for this slot) and BEFORE the language
      // routes: `/:lang/*` is terminal — it 404s rather than calling `next()` —
      // so a canonicalizing catch-all mounted after it would be dead code for
      // every two-plus-segment path, and `/manifesto/` matches it with
      // `lang = 'manifesto'` so single-segment paths would be missed too.
      // Mounted here rather than at the `server.ts` redirect position because
      // `/_admin` is registered INSIDE this function and would be shadowed.
      setupUrlCanonicalizationRoutes(
        // [internal ref]: the server-mode 301 that
        // sends a `contentDir.index` article's slugged URL (`/docs/introduction`)
        // to the collection base path (`/docs`). Registered AFTER the `.md` export
        // route (so the index article's `.md`/`Accept` twins still serve raw
        // markdown 200) and BEFORE the language + catch-all routes. Falls through
        // (`next()`) for every non-index request.
        setupContentDirIndexRedirectRoutes(
          // [internal ref]: the per-page `.md` export twin is
          // registered BEFORE the language routes and the dynamic-page catch-all
          // (`*`) — a `.md` path matches no page pattern and would otherwise 404
          // through the catch-all. It falls through (`next()`) for every non-export
          // request, so ordinary page resolution is untouched.
          setupMarkdownExportRoutes(
            // [internal ref]: the Native Admin Dashboard auto-mount at `/_admin` is
            // registered BEFORE the language routes and the dynamic-page catch-all
            // (`*`) so the dashboard route wins over the operator's own page
            // resolution — the mount is independent of (and never shadowed by) the
            // operator's config.
            setupAdminDashboardRoutes(
              setupRobotsRoute(
                setupSitemapRoute(
                  setupRssFeedRoute(
                    setupTestErrorRoute(setupHomepageRoute(honoApp, config), config),
                    config
                  ),
                  config
                ),
                config
              ),
              config
            ),
            config
          ),
          config
        ),
        config
      ),
      config
    ),
    config
  )
}
