/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { App } from '@/domain/models/app'

/**
 * Page renderer port for server-side rendering
 *
 * This interface defines the contract for rendering pages to HTML,
 * allowing the Application layer to remain decoupled from
 * Presentation layer implementations.
 *
 * All rendering functions are synchronous and return complete HTML documents.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const pageRenderer = yield* PageRenderer
 *
 *   // Render homepage with app data
 *   const homeHtml = pageRenderer.renderHome(app)
 *
 *   // Render error pages
 *   const notFoundHtml = pageRenderer.renderNotFound()
 *   const errorHtml = pageRenderer.renderError()
 *
 *   return { homeHtml, notFoundHtml, errorHtml }
 * })
 * ```
 */

/**
 * PageRenderer service for server-side HTML rendering
 *
 * Use this service via Effect Context to render React components
 * to HTML strings with type-safe dependency injection.
 */
export class PageRenderer extends Context.Tag('PageRenderer')<
  PageRenderer,
  {
    /**
     * Renders the application home page
     *
     * @param app - Validated application data from AppSchema
     * @param detectedLanguage - Optional detected language from Accept-Language header or URL
     * @returns Complete HTML document as string with embedded app data
     */
    readonly renderHome: (app: App, detectedLanguage?: string) => string

    /**
     * Renders any page by path
     *
     * @param app - Validated application data from AppSchema
     * @param path - Page path to render (e.g., '/', '/about')
     * @param detectedLanguage - Optional detected language from Accept-Language header or URL
     * @returns Complete HTML document as string, or undefined if page not found
     */
    readonly renderPage: (app: App, path: string, detectedLanguage?: string) => string | undefined

    /**
     * Renders the 404 Not Found page
     *
     * @returns Complete HTML document as string with 404 error message
     */
    readonly renderNotFound: () => string

    /**
     * Renders the 500 Internal Server Error page
     *
     * @returns Complete HTML document as string with error message
     */
    readonly renderError: () => string
  }
>() {}
