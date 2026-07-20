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
import { isPageCacheDevBypassed, isProduction as isProductionEnv } from '@/infrastructure/utils/env'
import { setupAdminDashboardRoutes } from './admin-dashboard-routes'
import { setupContentDirIndexRedirectRoutes } from './content-dir-index-redirect-routes'
import { setupMarkdownExportRoutes } from './markdown-export-routes'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/types/session-info'

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
    }
  ) => PageRenderResult | Promise<PageRenderResult>
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderRssFeed?: (app: App, baseUrl: string) => Promise<string | undefined>
  readonly getSession?: (headers: Headers) => Promise<SessionInfo | undefined>
}

function renderAccessErrorPage(message: string): string {
  return `<!DOCTYPE html><html><head><title>Access Error</title></head><body><p>${message}</p></body></html>`
}

type ResolvedPage =
  | { readonly redirect: string }
  | { readonly html: string }
  | { readonly unauthorized: true }
  | undefined

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

type CacheStatus = 'hit' | 'miss' | 'bypass'

interface PageRequestContext {
  readonly detectedLanguage?: string
  readonly session?: SessionInfo
  readonly cookies?: Readonly<Record<string, string>>
  readonly previewMode?: boolean
  readonly requestQuery?: Readonly<Record<string, string>>
}

function sendResolved(
  resolved: ReturnType<typeof resolvePageResult>,
  cacheStatus: CacheStatus,
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

async function checkSharedViewGate(
  config: HonoAppConfig,
  path: string,
  reqCtx: PageRequestContext,
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
  c: Context
): Promise<Response | undefined> {
  const { app, renderPage } = config

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

  const cacheKey = getPageCacheKey(computeAppRenderChecksum(app), path, reqCtx.detectedLanguage)
  const cached = await Effect.runPromise(getCachedPage(cacheKey))
  if (cached !== undefined) {
    return sendResolved({ html: cached.html }, 'hit', c)
  }

  const resolved = resolvePageResult(await renderPage(app, path, reqCtx))
  if (resolved !== undefined && 'html' in resolved) {
    await Effect.runPromise(setCachedPage(cacheKey, { html: resolved.html, timestamp: Date.now() }))
    return sendResolved(resolved, 'miss', c)
  }
  return sendResolved(resolved, 'bypass', c)
}

async function extractSession(
  config: HonoAppConfig,
  headers: Headers
): Promise<SessionInfo | undefined> {
  return config.getSession ? config.getSession(headers) : undefined
}

const EDITORIAL_ROLES: ReadonlySet<string> = new Set(['admin', 'editor'])

function resolvePreviewMode(
  c: { readonly req: { readonly query: (key: string) => string | undefined } },
  session: SessionInfo | undefined
): boolean {
  if (session === undefined) return false
  if (!EDITORIAL_ROLES.has(session.role)) return false
  return c.req.query('preview') === 'true'
}

export function setupHomepageRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app, renderErrorPage } = config

  return honoApp.get('/', async (c) => {
    try {
      const session = await extractSession(config, c.req.raw.headers)
      const cookies = getCookie(c)
      const previewMode = resolvePreviewMode(c, session)
      const reqCtx = { session, cookies, previewMode, requestQuery: c.req.query() }

      if (!app.languages || app.languages.detectBrowser === false) {
        return (await renderWithCache(config, '/', reqCtx, c)) ?? c.html('')
      }

      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      const targetLanguage = detectedLanguage || app.languages.default

      if (targetLanguage !== app.languages.default) {
        return c.redirect(`/${targetLanguage}/`, 302)
      }

      return (await renderWithCache(config, '/', reqCtx, c)) ?? c.html('')
    } catch (error) {
      logError('[SERVER] GET / → 500 Error rendering homepage', error)
      return c.html(await renderErrorPage(app), 500)
    }
  })
}

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

function handleLanguageHomepageRoute(config: HonoAppConfig) {
  const { app, renderNotFoundPage, renderErrorPage } = config
  return async (c: Readonly<Context>) => {
    try {
      const { path } = c.req
      const session = await extractSession(config, c.req.raw.headers)
      const cookies = getCookie(c)
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      const urlLanguage = validateLanguageSubdirectory(app, path)
      const previewMode = resolvePreviewMode(c, session)
      const requestQuery = c.req.query()
      const exact = await renderWithCache(
        config,
        path,
        {
          detectedLanguage: urlLanguage ?? detectedLanguage,
          session,
          cookies,
          previewMode,
          requestQuery,
        },
        c
      )
      if (exact) return exact
      if (!urlLanguage) {
        return c.html(await renderNotFoundPage(app, detectedLanguage), 404)
      }
      const lang = await renderWithCache(
        config,
        '/',
        { detectedLanguage: urlLanguage, session, cookies, previewMode, requestQuery },
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

function handleLanguagePageRoute(config: HonoAppConfig) {
  const { app, renderNotFoundPage, renderErrorPage } = config
  return async (c: Readonly<Context>) => {
    const { path } = c.req
    const session = await extractSession(config, c.req.raw.headers)
    const cookies = getCookie(c)
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    const urlLanguage = validateLanguageSubdirectory(app, path)
    const previewMode = resolvePreviewMode(c, session)
    const requestQuery = c.req.query()
    try {
      const exact = await renderWithCache(
        config,
        path,
        {
          detectedLanguage: urlLanguage ?? detectedLanguage,
          session,
          cookies,
          previewMode,
          requestQuery,
        },
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
        { detectedLanguage: urlLanguage, session, cookies, previewMode, requestQuery },
        c
      )
      return lang ?? c.html(await renderNotFoundPage(app, urlLanguage), 404)
    } catch (error) {
      logError(`[SERVER] GET ${path} → 500 Error rendering page`, error)
      return c.html(await renderErrorPage(app, detectedLanguage), 500)
    }
  }
}

export function setupLanguageRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  return honoApp
    .get('/:lang', handleBareLanguageRoute(config))
    .get('/:lang/', handleLanguageHomepageRoute(config))
    .get('/:lang/*', handleLanguagePageRoute(config))
}

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
    throw new Error('Test error')
  })
}

export function setupPageRoutes(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  return setupDynamicPageRoutes(
    setupLanguageRoutes(
      setupContentDirIndexRedirectRoutes(
        setupMarkdownExportRoutes(
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
