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
import type { App } from '@/domain/models/app'

/**
 * Hono app configuration for route setup
 */
export interface HonoAppConfig {
  readonly app: App
  readonly publicDir?: string
  readonly renderPage: (
    app: App,
    path: string,
    detectedLanguage?: string
  ) => string | undefined | Promise<string | undefined>
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
}

/**
 * Setup homepage route
 *
 * Handles:
 * - No languages configured: Serve default
 * - Browser detection disabled: Serve default
 * - Browser detection enabled: Detect and redirect if needed
 *
 * @param honoApp - Hono application instance
 * @param config - Route configuration
 * @returns Hono app with homepage route configured
 */
export function setupHomepageRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app, renderPage, renderErrorPage } = config

  return honoApp.get('/', async (c) => {
    try {
      // If no languages configured, render with default (en-US)
      if (!app.languages) {
        const html = await renderPage(app, '/', undefined)
        return c.html(html ?? '')
      }

      // If browser detection disabled, always serve default language at /
      if (app.languages.detectBrowser === false) {
        const html = await renderPage(app, '/', undefined)
        return c.html(html ?? '')
      }

      // Browser detection enabled - detect language from Accept-Language header
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      const targetLanguage = detectedLanguage || app.languages.default

      // Only redirect if detected language is different from default
      if (targetLanguage !== app.languages.default) {
        return c.redirect(`/${targetLanguage}/`, 302)
      }

      // Same as default - serve at / (no redirect, cacheable)
      const html = await renderPage(app, '/', undefined)
      return c.html(html ?? '')
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
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      const exactPageMatch = await renderPage(app, path, detectedLanguage)
      if (exactPageMatch) {
        return c.html(exactPageMatch)
      }
      const urlLanguage = validateLanguageSubdirectory(app, path)
      if (!urlLanguage) {
        const detectedLang = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
        return c.html(await renderNotFoundPage(app, detectedLang), 404)
      }
      const html = await renderPage(app, '/', urlLanguage)
      return c.html(html ?? '')
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
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    try {
      const exactPageMatch = await renderPage(app, path, detectedLanguage)
      if (exactPageMatch) {
        return c.html(exactPageMatch)
      }
      const urlLanguage = validateLanguageSubdirectory(app, path)
      if (!urlLanguage) {
        return c.html(await renderNotFoundPage(app, detectedLanguage), 404)
      }
      const pathWithoutLang = path.replace(`/${urlLanguage}`, '') || '/'
      const html = await renderPage(app, pathWithoutLang, urlLanguage)
      if (!html) {
        return c.html(await renderNotFoundPage(app, urlLanguage), 404)
      }
      return c.html(html)
    } catch (error) {
      logError(`[SERVER] GET ${path} → 500 Error rendering page`, error)
      return c.html(await renderErrorPage(app, detectedLanguage), 500)
    }
  }
}

/**
 * Setup language subdirectory routes
 *
 * Handles:
 * - GET /:lang/ - Homepage in specific language
 * - GET /:lang/* - Pages in specific language
 *
 * @param honoApp - Hono application instance
 * @param config - Route configuration
 * @returns Hono app with language routes configured
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
 *
 * Catches all other routes and attempts to render them as pages
 *
 * @param honoApp - Hono application instance
 * @param config - Route configuration
 * @returns Hono app with dynamic page routes configured
 */
export function setupDynamicPageRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  const { app, renderPage, renderNotFoundPage } = config

  return honoApp.get('*', async (c) => {
    const { path } = c.req
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    const html = await renderPage(app, path, detectedLanguage)
    if (!html) {
      return c.html(await renderNotFoundPage(app, detectedLanguage), 404)
    }
    return c.html(html)
  })
}

/**
 * Setup test error route
 *
 * Only available in non-production environments
 *
 * @param honoApp - Hono application instance
 * @param config - Route configuration
 * @returns Hono app with test error route configured
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
 *
 * Mounts all page-related routes in correct order
 *
 * @param honoApp - Hono application instance
 * @param config - Route configuration
 * @returns Hono app with all page routes configured
 */
export function setupPageRoutes(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  return setupDynamicPageRoutes(
    setupLanguageRoutes(setupTestErrorRoute(setupHomepageRoute(honoApp, config), config), config),
    config
  )
}
