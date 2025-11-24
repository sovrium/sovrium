/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToString } from 'react-dom/server'
import { ErrorPage } from '@/presentation/components/pages/ErrorPage'
import { NotFoundPage } from '@/presentation/components/pages/NotFoundPage'
import { renderPageByPath } from './render-homepage'
import type { App } from '@/domain/models/app'

/**
 * Renders NotFoundPage (404) to HTML string for server-side rendering
 *
 * If the app has a custom page configured at '/404', renders that page.
 * Otherwise, renders the default NotFoundPage.
 *
 * @param app - Optional validated application data from AppSchema
 * @param detectedLanguage - Optional detected language from Accept-Language header
 * @returns Complete HTML document as string with DOCTYPE
 */
export function renderNotFoundPage(app?: App, detectedLanguage?: string): string {
  // Try to render custom 404 page first if app is provided
  if (app) {
    const custom404 = renderPageByPath(app, '/404', detectedLanguage)
    if (custom404) {
      return custom404
    }
  }

  // Fallback to default 404 page
  const html = renderToString(<NotFoundPage />)
  return `<!DOCTYPE html>\n${html}`
}

/**
 * Renders ErrorPage (500) to HTML string for server-side rendering
 *
 * If the app has a custom page configured at '/500', renders that page.
 * Otherwise, renders the default ErrorPage.
 *
 * @param app - Optional validated application data from AppSchema
 * @param detectedLanguage - Optional detected language from Accept-Language header
 * @returns Complete HTML document as string with DOCTYPE
 */
export function renderErrorPage(app?: App, detectedLanguage?: string): string {
  // Try to render custom 500 page first if app is provided
  if (app) {
    const custom500 = renderPageByPath(app, '/500', detectedLanguage)
    if (custom500) {
      return custom500
    }
  }

  // Fallback to default 500 page
  const html = renderToString(<ErrorPage />)
  return `<!DOCTYPE html>\n${html}`
}
