/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Context, type Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { logError } from '@/infrastructure/logging/logger'
import {
  detectLanguageIfEnabled,
  validateLanguageSubdirectory,
} from '@/infrastructure/server/language-detection'
import { isProduction as isProductionEnv } from '@/infrastructure/utils/env'
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
    }
  ) => PageRenderResult | Promise<PageRenderResult>
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  /**
   * RSS feed renderer (US-PAGES-ACCESS-PUBLISHING-004 — APP-PAGES-PUBLISHING-014).
   *
   * Returns the RSS 2.0 XML body for the first collection page that
   * declares `rss !== false`, or `undefined` when no such page exists
   * (the route handler responds 404). Optional so callers that don't
   * provide a renderer (eg. legacy tests) get a 404 by default rather
   * than a runtime crash.
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
    | { readonly redirect: string }
    | { readonly error: string }
    | { readonly unauthorized: true }
): ResolvedPage {
  if ('redirect' in result) return { redirect: result.redirect }
  if ('error' in result) return { html: renderAccessErrorPage(result.error) }
  if ('unauthorized' in result) return { unauthorized: true }
  return undefined
}

/**
 * Sends a resolved page result as an HTTP response, or returns undefined for 404
 */
function sendResolved(
  resolved: ReturnType<typeof resolvePageResult>,
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context
): Response | undefined {
  if (!resolved) return undefined
  if ('redirect' in resolved) return c.redirect(resolved.redirect, 302)
  if ('unauthorized' in resolved) {
    return c.text('Unauthorized', 401)
  }
  return c.html(resolved.html)
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
 * Resolve the `previewMode` flag (US-PAGES-ACCESS-PUBLISHING-001 / APP-PAGES-PUBLISHING-003).
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
 * Setup homepage route
 */
export function setupHomepageRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app, renderPage, renderErrorPage } = config

  return honoApp.get('/', async (c) => {
    try {
      const session = await extractSession(config, c.req.raw.headers)
      const cookies = getCookie(c)
      const previewMode = resolvePreviewMode(c, session)
      const reqCtx = { session, cookies, previewMode }

      if (!app.languages || app.languages.detectBrowser === false) {
        const resolved = resolvePageResult(await renderPage(app, '/', reqCtx))
        return sendResolved(resolved, c) ?? c.html('')
      }

      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      const targetLanguage = detectedLanguage || app.languages.default

      if (targetLanguage !== app.languages.default) {
        return c.redirect(`/${targetLanguage}/`, 302)
      }

      const resolved = resolvePageResult(await renderPage(app, '/', reqCtx))
      return sendResolved(resolved, c) ?? c.html('')
    } catch (error) {
      logError('[SERVER] GET / → 500 Error rendering homepage', error)
      return c.html(await renderErrorPage(app), 500)
    }
  })
}

/**
 * Handle /:lang/ route (homepage in specific language)
 */
function handleLanguageHomepageRoute(config: HonoAppConfig) {
  const { app, renderPage, renderNotFoundPage, renderErrorPage } = config
  return async (c: Readonly<Context>) => {
    try {
      const { path } = c.req
      const session = await extractSession(config, c.req.raw.headers)
      const cookies = getCookie(c)
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      const previewMode = resolvePreviewMode(c, session)
      const exact = sendResolved(
        resolvePageResult(
          await renderPage(app, path, { detectedLanguage, session, cookies, previewMode })
        ),
        c
      )
      if (exact) return exact
      const urlLanguage = validateLanguageSubdirectory(app, path)
      if (!urlLanguage) {
        return c.html(await renderNotFoundPage(app, detectedLanguage), 404)
      }
      const lang = sendResolved(
        resolvePageResult(
          await renderPage(app, '/', {
            detectedLanguage: urlLanguage,
            session,
            cookies,
            previewMode,
          })
        ),
        c
      )
      return lang ?? c.html('')
    } catch (error) {
      logError(`[SERVER] GET ${c.req.path} → 500 Error rendering homepage`, error)
      const detectedLang = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      return c.html(await renderErrorPage(app, detectedLang), 500)
    }
  }
}

/**
 * Handle /:lang/* route (pages in specific language)
 */
function handleLanguagePageRoute(config: HonoAppConfig) {
  const { app, renderPage, renderNotFoundPage, renderErrorPage } = config
  return async (c: Readonly<Context>) => {
    const { path } = c.req
    const session = await extractSession(config, c.req.raw.headers)
    const cookies = getCookie(c)
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    const previewMode = resolvePreviewMode(c, session)
    try {
      const exact = sendResolved(
        resolvePageResult(
          await renderPage(app, path, { detectedLanguage, session, cookies, previewMode })
        ),
        c
      )
      if (exact) return exact
      const urlLanguage = validateLanguageSubdirectory(app, path)
      if (!urlLanguage) {
        return c.html(await renderNotFoundPage(app, detectedLanguage), 404)
      }
      const pathWithoutLang = path.replace(`/${urlLanguage}`, '') || '/'
      const lang = sendResolved(
        resolvePageResult(
          await renderPage(app, pathWithoutLang, {
            detectedLanguage: urlLanguage,
            session,
            cookies,
            previewMode,
          })
        ),
        c
      )
      return lang ?? c.html(await renderNotFoundPage(app, urlLanguage), 404)
    } catch (error) {
      logError(`[SERVER] GET ${path} → 500 Error rendering page`, error)
      return c.html(await renderErrorPage(app, detectedLanguage), 500)
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
  const { app, renderPage, renderNotFoundPage } = config

  return honoApp.get('*', async (c) => {
    const { path } = c.req
    const session = await extractSession(config, c.req.raw.headers)
    const cookies = getCookie(c)
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    const previewMode = resolvePreviewMode(c, session)
    const response = sendResolved(
      resolvePageResult(
        await renderPage(app, path, { detectedLanguage, session, cookies, previewMode })
      ),
      c
    )
    return response ?? c.html(await renderNotFoundPage(app, detectedLanguage), 404)
  })
}

/**
 * Setup the `/feed.xml` RSS endpoint (US-PAGES-ACCESS-PUBLISHING-004).
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
      logError('[SERVER] GET /feed.xml → 500 Error rendering RSS feed', error)
      return c.html(await renderErrorPage(app), 500)
    }
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
      setupRssFeedRoute(setupTestErrorRoute(setupHomepageRoute(honoApp, config), config), config),
      config
    ),
    config
  )
}
