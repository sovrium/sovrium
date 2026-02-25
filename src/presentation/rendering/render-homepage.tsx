/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToString } from 'react-dom/server'
import { findMatchingRoute } from '@/domain/utils/route-matcher'
import { DefaultHomePage } from '@/presentation/ui/pages/DefaultHomePage'
import { DynamicPage } from '@/presentation/ui/pages/DynamicPage'
import type { App } from '@/domain/models/app'
import type { BuiltInAnalytics } from '@/domain/models/app/analytics'

/**
 * Check if built-in analytics tracking should be injected for a given page path
 *
 * Returns true when analytics is configured and enabled, and the page path
 * is not in the excludedPaths list.
 */
function shouldInjectAnalytics(analytics: BuiltInAnalytics | undefined, pagePath: string): boolean {
  if (analytics === undefined || analytics === false) return false
  if (analytics === true) return true
  const { excludedPaths } = analytics
  if (!excludedPaths || excludedPaths.length === 0) return true
  return !excludedPaths.some((pattern: string) => {
    // Support simple glob patterns: * matches any segment, ** matches anything
    const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$')
    return regex.test(pagePath)
  })
}

/**
 * Renders a page by path to HTML string for server-side rendering
 *
 * Supports both static routes (exact match) and dynamic routes (with :param segments)
 *
 * @param app - Validated application data from AppSchema
 * @param path - Page path to render (e.g., '/', '/about', '/blog/hello-world')
 * @param detectedLanguage - Optional detected language from Accept-Language header or URL
 * @returns Complete HTML document as string with DOCTYPE, or undefined if page not found
 */
export function renderPageByPath(
  app: App,
  path: string,
  detectedLanguage?: string
): string | undefined {
  // If no pages configured, return undefined
  if (!app.pages || app.pages.length === 0) {
    return undefined
  }

  // Extract all page patterns and find matching route
  const pagePatterns = app.pages.map((p) => p.path)
  const match = findMatchingRoute(pagePatterns, path)

  if (!match) {
    return undefined
  }

  // Get the matched page
  const page = app.pages[match.index]
  if (!page) {
    return undefined
  }

  const injectAnalytics = shouldInjectAnalytics(app.analytics, page.path)

  const html = renderToString(
    <DynamicPage
      page={page}
      components={app.components}
      theme={app.theme}
      languages={app.languages}
      detectedLanguage={detectedLanguage}
      routeParams={match.params}
      builtInAnalyticsEnabled={injectAnalytics}
    />
  )

  return `<!DOCTYPE html>\n${html}`
}

/**
 * Renders homepage to HTML string for server-side rendering
 *
 * If the app has custom pages configured, renders the page with path '/'
 * Otherwise, renders the default homepage
 *
 * @param app - Validated application data from AppSchema
 * @param detectedLanguage - Optional detected language from Accept-Language header
 * @returns Complete HTML document as string with DOCTYPE
 */
// @knip-ignore - Used via dynamic import in StartServer.ts
export function renderHomePage(app: App, detectedLanguage?: string): string {
  // Try to render custom homepage first
  const customHomePage = renderPageByPath(app, '/', detectedLanguage)
  if (customHomePage) {
    return customHomePage
  }

  // Fallback to default homepage
  const html = renderToString(<DefaultHomePage app={app} />)
  return `<!DOCTYPE html>\n${html}`
}

/**
 * Renders any page by path to HTML string for server-side rendering
 *
 * @param app - Validated application data from AppSchema
 * @param path - Page path to render (e.g., '/', '/about')
 * @param detectedLanguage - Optional detected language from Accept-Language header
 * @returns Complete HTML document as string with DOCTYPE, or undefined if page not found
 */
// @knip-ignore - Used via dynamic import in server.ts
export function renderPage(app: App, path: string, detectedLanguage?: string): string | undefined {
  return renderPageByPath(app, path, detectedLanguage)
}
