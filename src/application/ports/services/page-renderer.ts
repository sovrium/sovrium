/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'

/**
 * Result of rendering a page, including access control outcomes
 */
export type PageRenderResult =
  | string
  | undefined
  | { readonly redirect: string }
  | { readonly error: string }
  | { readonly unauthorized: true }

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
export class PageRenderer extends Context.Service<
  PageRenderer,
  {
    /**
     * Renders any page by path
     *
     * For the homepage ('/'), falls back to a default homepage when no custom page exists.
     *
     * @param app - Validated application data from AppSchema
     * @param path - Page path to render (e.g., '/', '/about')
     * @param detectedLanguage - Optional detected language from Accept-Language header or URL
     * @param session - Optional session info for access control decisions
     * @returns Complete HTML document as string, or undefined if page not found
     */
    readonly renderPage: (
      app: App,
      path: string,
      requestContext?: {
        readonly detectedLanguage?: string
        readonly session?: SessionInfo
        readonly cookies?: Readonly<Record<string, string>>
        /**
         * Preview mode flag.
         *
         * When `true` AND the active session has an editorial role
         * (`admin` or `editor`), `collection.filter` predicates are bypassed
         * so unpublished/draft records can be previewed via their public
         * collection-page URL. Anonymous visitors and non-editorial roles
         * see the same 404 they would otherwise see — preview is a
         * privileged opt-in, not a security boundary.
         */
        readonly previewMode?: boolean
        /**
         * The `/:lang/` URL-prefix locale ([internal ref]..039).
         *
         * Kept separate from `detectedLanguage` — which also carries the browser
         * `Accept-Language` guess — because only a locale the visitor asked for
         * BY URL outranks a page's own `meta.lang`.
         */
        readonly urlLanguage?: string
        /**
         * G1: the scheme + host this request arrived on, which feeds
         * `$app.origin`. Only the live request knows it, so it cannot be a
         * config constant.
         */
        readonly requestOrigin?: string
        /**
         * G1: the app whose OWN facts `$app.*` prints, when that is not the app
         * being rendered. A mounted embedded app renders its own preset pages
         * while the name, version and brand it must show are the OPERATOR's —
         * a fact the preset config cannot contain.
         */
        readonly hostApp?: App
        /**
         * G2: the mount base every derived breadcrumb href hangs off. A mounted
         * page is rendered against a path already stripped of the base, so
         * without this every derived crumb would link OUT of the mount.
         */
        readonly basePath?: string
        /**
         * G3: the renderer's server-side rows reader — the only way
         * `page.redirectToFirst` can learn the first row of a list that is a
         * READ ENDPOINT rather than a table.
         *
         * Optional, and its absence is INDISTINGUISHABLE from an empty
         * collection: the resolver degrades to "no first row" and renders the
         * page. That is correct for a caller with no request to borrow an
         * identity from, and a silent trap for one that has a request and simply
         * forgot to pass it — which is what happened to the mounted-app funnel
         * for as long as this field was absent from the port.
         */
        readonly fetchSystemRows?: (
          endpoint: string,
          rowsKey: string
        ) => Promise<readonly Record<string, unknown>[]>
        /**
         * [internal ref]: the SINGLE-RECORD sibling, for a page-level `{ system }`
         * binding.
         *
         * Its absence is NOT indistinguishable from a missing record, and the
         * asymmetry with the rows reader above is deliberate: absent, the page
         * falls back to the client-side enhancer marker, because a render with
         * no request has no caller whose 404 it could be. A fetcher that IS
         * present and answers `undefined` means the opposite — a caller who
         * exists and for whom the record does not — and that is the page's 404.
         */
        readonly fetchSystemRecord?: (
          endpoint: string,
          recordKey: string | undefined
        ) => Promise<Readonly<Record<string, unknown>> | undefined>
        /**
         * P10/mount: the caller's resolved POWERS, when the route layer knows
         * them and the renderer does not.
         *
         * A mounted embedded app renders SESSION-LESS on purpose — handing the
         * renderer a session would switch on page `access`, `visibility.roles`,
         * `$user.*` and row-level filtering across every mounted surface at
         * once. But the mount has already resolved the caller's two powers in
         * order to decide whether to serve the request at all, and without
         * them `visibility.capability` and an action column's `capability` are
         * inert on every mounted page — inert in the direction that hides the
         * affordance from the administrator it was written for.
         *
         * Passing the derived powers rather than the session is what keeps the
         * blast radius at the capability gate: a capability set cannot be read
         * as a role, resolve a `$user.*` reference, or reach a row filter.
         */
        readonly callerCapabilities?: readonly CallerCapability[]
      }
    ) => PageRenderResult | Promise<PageRenderResult>

    /**
     * Renders the 404 Not Found page
     *
     * @param app - Optional validated application data (for custom 404 pages)
     * @param detectedLanguage - Optional detected language
     * @returns Complete HTML document as string with 404 error message
     */
    readonly renderNotFound: (app?: App, detectedLanguage?: string) => string | Promise<string>

    /**
     * Renders the 500 Internal Server Error page
     *
     * @param app - Optional validated application data (for custom 500 pages)
     * @param detectedLanguage - Optional detected language
     * @returns Complete HTML document as string with error message
     */
    readonly renderError: (app?: App, detectedLanguage?: string) => string | Promise<string>

    /**
     * Render the RSS 2.0 feed XML for the first collection page that opts
     * in via `page.rss !== false && page.rss !== undefined`
     * ([internal ref]..018).
     *
     * Returns `undefined` when no page in `app.pages` declares `rss`,
     * which the route handler maps to a 404 — the `/feed.xml` endpoint
     * only exists when at least one collection page opts in. The
     * `baseUrl` is the absolute origin of the request (eg.
     * `http://localhost:3000`); per-item links and the channel
     * `<atom:link rel="self">` are built relative to it.
     */
    readonly renderRssFeed: (app: App, baseUrl: string) => Promise<string | undefined>
  }
>()('PageRenderer') {}
