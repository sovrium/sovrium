/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { type Context, type Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { parseEcoPageCache } from '@/domain/models/env/eco/eco-page-cache'
import { computeAppRenderChecksum } from '@/domain/services/app-render-checksum'
import { buildRobotsTxt, buildSitemapXml } from '@/domain/services/feeds/sitemap-builder'
import { isRenderablePathCacheable } from '@/domain/services/pages/page-cacheability'
import { isSharedViewAccessDenied } from '@/domain/services/pages/page-shared-view-guard'
import { logError } from '@/infrastructure/logging/logger'
import {
  getCachedPage,
  getPageCacheKey,
  setCachedPage,
} from '@/infrastructure/server/cache/page-cache-service'
import {
  detectLanguageIfEnabled,
  validateLanguageSubdirectory,
} from '@/infrastructure/server/language-detection'
import { runRequestEffect } from '@/infrastructure/server/run-request-effect'
import { isPageCacheDevBypassed, isProduction as isProductionEnv } from '@/infrastructure/utils/env'
import { setupAdminDashboardRoutes } from './admin-dashboard-routes'
import { setupContentDirIndexRedirectRoutes } from './content-dir-index-redirect-routes'
import { setupMarkdownExportRoutes } from './markdown-export-routes'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/types/session-info'

/**
 * Status served by the rendered error page.
 *
 * Declared once and interpolated into BOTH the log line and the response so the
 * two can never drift. The `→ 500` was previously hard-coded into every log
 * message here and in `createHonoApp`'s `.onError`; in the latter the response
 * status later became variable (an `HTTPException` carries its own), leaving the
 * log permanently claiming 500 for what the wire reported as a 504 — the exact
 * mismatch that made the 2026-07-25 production incident unreadable from logs.
 */
const ERROR_PAGE_STATUS = 500

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
 * Renders an access error page with a visible error message
 */
function renderAccessErrorPage(message: string): string {
  return `<!DOCTYPE html><html><head><title>Access Error</title></head><body><p>${message}</p></body></html>`
}

type ResolvedPage =
  | { readonly redirect: string }
  | { readonly html: string }
  | { readonly unauthorized: true }
  | undefined

/**
 * Resolves a PageRenderResult into one of: redirect URL, error HTML, page HTML,
 * unauthorized signal, or undefined (404)
 */
function resolvePageResult(result: PageRenderResult): ResolvedPage {
  if (typeof result === 'string') return { html: result }
  if (!result || typeof result !== 'object') return undefined
  return resolveObjectResult(result)
}

function resolveObjectResult(
  result:
    { readonly redirect: string } | { readonly error: string } | { readonly unauthorized: true }
): ResolvedPage {
  if ('redirect' in result) return { redirect: result.redirect }
  if ('error' in result) return { html: renderAccessErrorPage(result.error) }
  if ('unauthorized' in result) return { unauthorized: true }
  return undefined
}

/**
 * Cache disposition for a page response, surfaced via the `X-Render-Cache`
 * header: `hit` (served from the page cache), `miss` (rendered then stored),
 * `bypass` (not cacheable, authenticated, preview, or `ECO_PAGE_CACHE=off`).
 */
type CacheStatus = 'hit' | 'miss' | 'bypass'

/** Per-request render context threaded through to the page renderer. */
interface PageRequestContext {
  readonly detectedLanguage?: string
  readonly session?: SessionInfo
  readonly cookies?: Readonly<Record<string, string>>
  readonly previewMode?: boolean
  /** GAP-3 / [internal ref]: request query string for embedded `$query` prefill. */
  readonly requestQuery?: Readonly<Record<string, string>>
  /**
   * The `/:lang/` URL-prefix locale ([internal ref]..039), when the request
   * carried one. `detectedLanguage` above collapses the URL prefix and the
   * browser `Accept-Language` guess into one value; this keeps the URL prefix
   * distinguishable, because only IT outranks a page's own `meta.lang`.
   */
  readonly urlLanguage?: string
}

/**
 * Sends a resolved page result as an HTTP response, or returns undefined for 404.
 *
 * HTML page responses carry two cache headers:
 *  - `X-Render-Cache`: the {@link CacheStatus} (diagnostic / E2E observable).
 *  - `Cache-Control`: `public, max-age=300` for hits/misses (the render is
 *    request-invariant and may be shared by CDN/proxy layers), or
 *    `private, no-cache` for bypassed responses.
 *
 * Redirect and unauthorized responses are not pages and carry no cache headers.
 */
function sendResolved(
  resolved: ReturnType<typeof resolvePageResult>,
  cacheStatus: CacheStatus,
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context
): Response | undefined {
  if (!resolved) return undefined
  if ('redirect' in resolved) return c.redirect(resolved.redirect, 302)
  if ('unauthorized' in resolved) {
    return c.text('Unauthorized', 401)
  }
  return c.html(resolved.html, 200, {
    'X-Render-Cache': cacheStatus,
    'Cache-Control': cacheStatus === 'bypass' ? 'private, no-cache' : 'public, max-age=300',
  })
}

/**
 * Render a page, serving it from — or storing it in — the static page-output
 * cache when eligible. Returns the HTTP response, or `undefined` for a 404
 * fall-through (the caller then renders its own not-found page).
 *
 * The cache is consulted only for anonymous, non-preview requests to a
 * cacheable path while `ECO_PAGE_CACHE` is on (see
 * `domain/services/page-cacheability.ts` for the safety model). Every other
 * request renders fresh and reports `bypass`. Cache entries are keyed by the
 * app render-checksum, so a schema change makes stale entries unreachable.
 */
/**
 * PG-03 / [internal ref] — shared-view anti-enumeration.
 *
 * Returns a 404 Response when `?userView=<id>` is present in the URL AND the
 * matched page binds a data-table the session cannot read. Returns
 * `undefined` to let render proceed normally.
 *
 * Extracted from {@link renderWithCache} so the cache path keeps its
 * cyclomatic complexity below the per-function cap.
 */
async function checkSharedViewGate(
  config: HonoAppConfig,
  path: string,
  reqCtx: PageRequestContext,
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context
): Promise<Response | undefined> {
  const userViewParam = c.req.query('userView')
  if (userViewParam === undefined || userViewParam === '') return undefined
  const denied = isSharedViewAccessDenied(
    config.app,
    path,
    `userView=${encodeURIComponent(userViewParam)}`,
    reqCtx.session
      ? { role: reqCtx.session.role, effectiveRoles: reqCtx.session.effectiveRoles }
      : undefined
  )
  if (!denied) return undefined
  return c.html(await config.renderNotFoundPage(config.app, reqCtx.detectedLanguage), 404)
}

async function renderWithCache(
  config: HonoAppConfig,
  path: string,
  reqCtx: PageRequestContext,
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context
): Promise<Response | undefined> {
  const { app, renderPage } = config

  // PG-03 / [internal ref] — shared-view anti-enumeration. Applied
  // here (rather than per-route) so every page surface — language
  // subdirectories, the catch-all, the homepage — observes the same gate.
  const gateResponse = await checkSharedViewGate(config, path, reqCtx, c)
  if (gateResponse !== undefined) return gateResponse

  const cacheUsable =
    parseEcoPageCache(process.env) === 'on' &&
    !isPageCacheDevBypassed() &&
    reqCtx.session === undefined &&
    reqCtx.previewMode !== true &&
    isRenderablePathCacheable(app, path)

  if (!cacheUsable) {
    return sendResolved(resolvePageResult(await renderPage(app, path, reqCtx)), 'bypass', c)
  }

  const cacheKey = getPageCacheKey(
    computeAppRenderChecksum(app),
    path,
    reqCtx.detectedLanguage,
    reqCtx.urlLanguage
  )
  const cached = await Effect.runPromise(getCachedPage(cacheKey))
  if (cached !== undefined) {
    return sendResolved({ html: cached.html }, 'hit', c)
  }

  const resolved = resolvePageResult(await renderPage(app, path, reqCtx))
  if (resolved !== undefined && 'html' in resolved) {
    // eslint-disable-next-line functional/no-expression-statements
    await Effect.runPromise(setCachedPage(cacheKey, { html: resolved.html, timestamp: Date.now() }))
    return sendResolved(resolved, 'miss', c)
  }
  return sendResolved(resolved, 'bypass', c)
}

/**
 * Extracts session info from request headers using the config's getSession callback
 */
async function extractSession(
  config: HonoAppConfig,
  headers: Headers
): Promise<SessionInfo | undefined> {
  return config.getSession ? config.getSession(headers) : undefined
}

const EDITORIAL_ROLES: ReadonlySet<string> = new Set(['admin', 'editor'])

/**
 * Resolve the `previewMode` flag.
 *
 * Returns `true` only when:
 *  1. The request URL carries `?preview=true`, AND
 *  2. The active session belongs to a built-in editorial role (`admin` or
 *     `editor`).
 *
 * Anonymous visitors and members/viewers see the same 404 they would
 * otherwise see on a draft slug — the preview path is privileged opt-in,
 * not a security boundary. Reading the query string explicitly (rather
 * than passing the whole URL through) keeps the page renderer pure and
 * Hono-agnostic.
 */
function resolvePreviewMode(
  c: { readonly req: { readonly query: (key: string) => string | undefined } },
  session: SessionInfo | undefined
): boolean {
  if (session === undefined) return false
  if (!EDITORIAL_ROLES.has(session.role)) return false
  return c.req.query('preview') === 'true'
}

/**
 * Render a page through the request-edge tracing wrapper
 *.
 *
 * `runRequestEffect` opens the ROOT `http.server <METHOD> <route>` span (and the
 * in-span request log that auto-correlates to it); the SSR render runs as a CHILD
 * `page.render` span chaining under that root — the guaranteed child a `GET /`
 * fires. Transparent when traces are off: `Effect.withSpan`
 * resolves to the no-op tracer, so only the render runs and the Response is
 * returned unchanged.
 */
function renderTracedPage(
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context,
  config: HonoAppConfig,
  path: string,
  reqCtx: PageRequestContext
): Promise<Response | undefined> {
  return runRequestEffect(
    c,
    Effect.promise(() => renderWithCache(config, path, reqCtx, c)).pipe(
      Effect.withSpan('page.render', { attributes: { route: c.req.routePath } })
    )
  )
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
    const xml = buildSitemapXml(app.pages ?? [], baseUrl)
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
  )
}
