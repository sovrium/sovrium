/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { LookupReadMask } from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { ViewerIdentity } from '@/domain/models/app/pages/component-session-visibility-service'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'
import type { CallerFieldReader } from '@/domain/models/app/tables/field-read-filter-service'
import type { CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'
import type {
  RowGrants,
  RowReadAdmission,
} from '@/domain/models/app/tables/row-read-admission-service'
import type { RowRuleReader } from '@/domain/models/app/tables/visitor-row-rule-service'

/** Result of rendering a page, including access control outcomes */
export type PageRenderResult =
  | string
  | undefined
  | { readonly redirect: string }
  | { readonly error: string }
  | { readonly unauthorized: true }

/**
 * A table as ONE caller may see it, in the shapes the table API answers her: the
 * views `GET /api/tables/:t/views` lists her (each naming only fields she may
 * read), and the map `GET /api/tables/:t/permissions` answers her (`undefined`
 * where that route refuses her).
 */
export type CallerTableView = {
  readonly views: readonly unknown[]
  readonly permissionMap:
    | {
        readonly table: {
          readonly read: boolean
          readonly create: boolean
          readonly update: boolean
          readonly delete: boolean
        }
        readonly fields: Readonly<
          Record<string, { readonly read: boolean; readonly write: boolean }>
        >
      }
    | undefined
  /**
   * When the read named one of the table's views: that view's definition as
   * `GET /api/tables/:t/views/:v` answers her — its `fields` masked to those she
   * may read — or `undefined` where that route refuses her.
   */
  readonly boundView?: { readonly fields?: readonly string[] } | undefined
  /**
   * `true` when the records list admits her no row (no field readable): the
   * table API answers her as a table that does not exist, and no grid is drawn.
   */
  readonly refused?: true
  /**
   * Where the table API answers her no permission map (`refused`, or a table
   * whose read rule refuses her): the fields her role may read or write by the
   * table's field rules — what a form she may submit offers her, and no other.
   */
  readonly formFields?: readonly string[]
}

/**
 * Read a table of `app` as the caller holding `session` (none: a visitor).
 * Supplied by the route layer, which may reach the table use-cases the renderer
 * may not, so a page hands its reader exactly what the table API would.
 */
export type ReadTableAsCaller = (
  app: App,
  tableName: string,
  session: SessionInfo | undefined,
  /** One of the table's views, by id or name, whose definition to read as well. */
  view?: string
) => Promise<CallerTableView>

/**
 * The display labels of one record its page is bound to, as the records API
 * answers the caller holding `session` (none: a visitor), keyed by field: a
 * person by name, a linked record by its display field; `undefined` if none.
 */
export type ReadRecordLabels = (
  app: App,
  tableName: string,
  record: Readonly<Record<string, unknown>>,
  session: SessionInfo | undefined
) => Promise<Readonly<Record<string, string | readonly string[]>> | undefined>

/**
 * The context `tableName`'s row-level rule judges `reader` by (none: a
 * visitor), as the records API loads it: her assignments, and the ids each
 * `contains` or relationship leaf admits. Read once per request and table.
 */
export type LoadRowRuleContext = (
  app: App,
  tableName: string,
  reader: RowRuleReader | undefined
) => Promise<CurrentUserContext>

/**
 * The rows of `tableName` the records list admits the caller holding `session`
 * (none: a visitor), and the grants that admit them — the list's own answer
 * (`readerRowsOf`), so a server-drawn list draws and counts exactly those rows.
 */
export type ReadReaderRows = (
  app: App,
  tableName: string,
  session: SessionInfo | undefined
) => Promise<{ readonly admission: RowReadAdmission; readonly grants: RowGrants }>

/**
 * The lookups and counts of `tableName` a query must read as the records list
 * reads them for the caller holding `session` (none: a visitor): the list's own
 * masks (`lookupReadMasks`), so a server-drawn list keeps exactly her rows.
 */
export type ReadQueryMasks = (
  app: App,
  tableName: string,
  session: SessionInfo | undefined,
  query: { readonly filter?: readonly DataFilter[]; readonly sort?: readonly DataSort[] }
) => Promise<readonly LookupReadMask[]>

/**
 * Sign a download address for one stored file, for the caller of this request.
 *
 * `scope: 'record'` — the file is an attachment of a record the page has
 * already read for her, so the record's own gates have answered; `'bucket'` —
 * a fixed file the page names, which she may preview only where the bucket's
 * own sign permission admits her. `undefined` where it does not.
 */
export type SignFileUrl = (
  bucket: string,
  key: string,
  scope: 'record' | 'bucket',
  display?: 'inline'
) => Promise<string | undefined>

/**
 * Read one page of rows of one table for the sitemap's record fan-out: the
 * named columns only, filtered by the collection page's own `filter`, live rows
 * only (`liveOnly`), in a stable order, at most `pageSize` rows. The caller has
 * already decided the table and its address field are anonymously readable.
 */
export type FetchSitemapRecords = (
  tableName: string,
  options: {
    readonly fields: readonly string[]
    readonly filter?: readonly DataFilter[]
    readonly sort: readonly DataSort[]
    readonly pageSize: number
    readonly page: number
    readonly liveOnly: true
    /** The lookups and counts the filter names, read as her records list reads them. */
    readonly lookupMasks?: readonly LookupReadMask[]
  }
) => Promise<readonly Readonly<Record<string, unknown>>[]>

/**
 * Render the RSS feed of the first public page opting in. `readQueryMasks`
 * reads the lookups and counts its collection filter names as a signed-out
 * reader's records list reads them; absent, the feed steers on stored values.
 */
export type RenderRssFeed = (
  app: App,
  baseUrl: string,
  readQueryMasks?: ReadQueryMasks
) => Promise<string | undefined>

/**
 * Page renderer port for server-side rendering
 *
 * This interface defines the contract for rendering pages to HTML,
 * allowing the Application layer to remain decoupled from
 * Presentation layer implementations.
 *
 * Use it via Effect Context; each render answers a complete HTML document.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const pageRenderer = yield* PageRenderer
 *
 *   // Render the homepage (a default one when the app declares none)
 *   const homeHtml = pageRenderer.renderPage(app, '/')
 *
 *   // Render error pages
 *   const notFoundHtml = pageRenderer.renderNotFound()
 *   const errorHtml = pageRenderer.renderError()
 *
 *   return { homeHtml, notFoundHtml, errorHtml }
 * })
 * ```
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
         * The `/:lang/` URL-prefix locale.
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
         * The SINGLE-RECORD sibling, for a page-level `{ system }`
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
         * A mounted embedded app renders SESSION-LESS on purpose — a session
         * would switch on page `access`, `visibility.roles`, `$user.*` and
         * row-level filtering across every mounted surface at once — so the
         * powers the mount already resolved travel instead: without them
         * `visibility.capability` and an action column's `capability` are inert
         * there, hiding the affordance from the administrator it was written
         * for. A capability set cannot be read as a role or reach a row filter.
         */
        readonly callerCapabilities?: readonly CallerCapability[]
        /** That caller's id and email, answering a `$user.id` / `$user.email` condition only. */
        readonly viewerIdentity?: ViewerIdentity | undefined
        /**
         * The mounted console caller's role and groups, for the one question a
         * session-less render cannot otherwise answer: which of a table's
         * fields her record sheet may show and edit. Narrow on purpose, as
         * `callerCapabilities` is: it reaches the record sheet's field access
         * and nothing else.
         */
        readonly callerFieldReader?: CallerFieldReader | undefined
        /**
         * The table API's own answer to "what may this caller see of this
         * table?", for the payload a data-table grid hands its reader (its
         * views, its permission map, its field list). Absent, a grid keeps
         * every view and field the table declares and carries no permissions.
         */
        readonly readTableAsCaller?: ReadTableAsCaller
        /** The records API's labels of a bound record: a person's name, a linked record's. */
        readonly readRecordLabels?: ReadRecordLabels
        /** The records API's row-rule context, for the rows a page judges in memory. */
        readonly loadRowRuleContext?: LoadRowRuleContext
        /** The rows the records list admits this caller, for every list a page draws. */
        readonly readReaderRows?: ReadReaderRows
        /** The records list's masks of the lookups and counts a page's query names. */
        readonly readQueryMasks?: ReadQueryMasks
        /** The download-address signer a `file-preview` draws its file through. */
        readonly signFileUrl?: SignFileUrl
        /**
         * The request's query string, by key: an invitation page reads its
         * token here, and `$query.*` tokens read the page's declared keys.
         */
        readonly requestQuery?: Readonly<Record<string, string>>
        /**
         * Render a design-system SPECIMEN: every reader answers a sample
         * synthesised from config (no record, invitation, sign-in or history of
         * the instance is read), every caller-scoped reader above is dropped,
         * and no island is mounted, so the document is a picture of the
         * template in its main state rather than a live page. It is drawn at
         * the specimen instant (`SPECIMEN_INSTANT`), whatever the clock says.
         */
        readonly specimen?: boolean
        /**
         * The instant every clock read of the render answers, for a drawing
         * that must not depend on when it was made. Absent, a page reads the
         * server's clock.
         */
        readonly drawnAt?: Readonly<Date>
      }
    ) => PageRenderResult | Promise<PageRenderResult>

    /**
     * Renders the 404 Not Found page
     *
     * @param app - Optional validated application data (for custom 404 pages)
     * @param detectedLanguage - Optional detected language
     * @returns Complete HTML document as string with 404 error message
     */
    readonly renderNotFound: (
      app?: App,
      detectedLanguage?: string,
      requestPath?: string
    ) => string | Promise<string>

    /**
     * Renders the 500 Internal Server Error page
     *
     * @param app - Optional validated application data (for custom 500 pages)
     * @param detectedLanguage - Optional detected language
     * @returns Complete HTML document as string with error message
     */
    readonly renderError: (
      app?: App,
      detectedLanguage?: string,
      requestId?: string
    ) => string | Promise<string>

    /**
     * Render the RSS 2.0 feed XML for the first PUBLIC page that opts in via
     * `page.rss !== false && page.rss !== undefined` — see `findRssPage`.
     *
     * Returns `undefined` when no public page in `app.pages` declares `rss`,
     * which the route handler maps to a 404 — the `/feed.xml` endpoint only
     * exists when at least one collection page opts in. The `baseUrl` is the
     * request's absolute origin (eg. `http://localhost:3000`); per-item links
     * and the channel `<atom:link rel="self">` are built relative to it.
     */
    readonly renderRssFeed: RenderRssFeed
    /** Row reader behind the sitemap's record fan-out. */
    readonly fetchSitemapRecords: FetchSitemapRecords
  }
>()('PageRenderer') {}
