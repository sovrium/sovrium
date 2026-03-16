/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Context, type Hono } from 'hono'
import { logError } from '@/infrastructure/logging/logger'
import {
  detectLanguageIfEnabled,
  validateLanguageSubdirectory,
} from '@/infrastructure/server/language-detection'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/**
 * Hono app configuration for route setup
 */
export interface HonoAppConfig {
  readonly app: App
  readonly publicDir?: string
  readonly renderPage: (
    app: App,
    path: string,
    detectedLanguage?: string,
    session?: SessionInfo
  ) => PageRenderResult | Promise<PageRenderResult>
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly getSession?: (headers: Headers) => Promise<SessionInfo | undefined>
}

/**
 * Renders an access error page with a visible error message
 */
function renderAccessErrorPage(message: string): string {
  return `<!DOCTYPE html><html><head><title>Access Error</title></head><body><p>${message}</p></body></html>`
}

/**
 * Resolves a PageRenderResult into one of: redirect URL, error HTML, page HTML, or undefined (404)
 */
function resolvePageResult(
  result: PageRenderResult
): { readonly redirect: string } | { readonly html: string } | undefined {
  if (result && typeof result === 'object' && 'redirect' in result) {
    return { redirect: result.redirect }
  }
  if (result && typeof result === 'object' && 'error' in result) {
    return { html: renderAccessErrorPage(result.error) }
  }
  if (typeof result === 'string') return { html: result }
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

/**
 * Setup homepage route
 */
export function setupHomepageRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app, renderPage, renderErrorPage } = config

  return honoApp.get('/', async (c) => {
    try {
      const session = await extractSession(config, c.req.raw.headers)

      if (!app.languages || app.languages.detectBrowser === false) {
        const resolved = resolvePageResult(await renderPage(app, '/', undefined, session))
        return sendResolved(resolved, c) ?? c.html('')
      }

      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      const targetLanguage = detectedLanguage || app.languages.default

      if (targetLanguage !== app.languages.default) {
        return c.redirect(`/${targetLanguage}/`, 302)
      }

      const resolved = resolvePageResult(await renderPage(app, '/', undefined, session))
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
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      const exact = sendResolved(
        resolvePageResult(await renderPage(app, path, detectedLanguage, session)),
        c
      )
      if (exact) return exact
      const urlLanguage = validateLanguageSubdirectory(app, path)
      if (!urlLanguage) {
        return c.html(await renderNotFoundPage(app, detectedLanguage), 404)
      }
      const lang = sendResolved(
        resolvePageResult(await renderPage(app, '/', urlLanguage, session)),
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
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    try {
      const exact = sendResolved(
        resolvePageResult(await renderPage(app, path, detectedLanguage, session)),
        c
      )
      if (exact) return exact
      const urlLanguage = validateLanguageSubdirectory(app, path)
      if (!urlLanguage) {
        return c.html(await renderNotFoundPage(app, detectedLanguage), 404)
      }
      const pathWithoutLang = path.replace(`/${urlLanguage}`, '') || '/'
      const lang = sendResolved(
        resolvePageResult(await renderPage(app, pathWithoutLang, urlLanguage, session)),
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
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    const response = sendResolved(
      resolvePageResult(await renderPage(app, path, detectedLanguage, session)),
      c
    )
    return response ?? c.html(await renderNotFoundPage(app, detectedLanguage), 404)
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
    if (process.env.NODE_ENV === 'production') {
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      return c.html(renderNotFoundPage(app, detectedLanguage), 404)
    }
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error('Test error')
  })
}

/**
 * Setup page routes (homepage, language subdirectories, dynamic pages)
 */
export function setupPageRoutes(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  return setupDynamicPageRoutes(
    setupLanguageRoutes(setupTestErrorRoute(setupHomepageRoute(honoApp, config), config), config),
    config
  )
}
