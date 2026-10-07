/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two entry points of server-side page rendering.
 *
 * `renderPageByPath` is the request pipeline read top to bottom: find the
 * declared page, resolve who is asking, refuse or redirect, resolve the page,
 * then assemble the document. Every step it names lives in a sibling module —
 * the gates in `page-access-gating.tsx` and `page-crud-gating.tsx`, the filter
 * pipeline in `page-component-filters.tsx`, the request/collection resolution
 * in `page-collection-resolver.ts` and `page-row-scope-resolver.ts`, the
 * document itself in `page-document-assembly.tsx` — so that this file stays the
 * ORDER those steps run in and nothing else.
 *
 * `renderPage` wraps it with the one fallback the engine owes an app that
 * declares no home page.
 */

import { renderToString } from 'react-dom/server'
import { frontmatterAccess, isArticleReadable } from '@/domain/models/app/pages/content-dir-access'
import { checkPageAccess } from '@/domain/models/app/pages/page-access-check'
import { findDeclaredPage } from '@/domain/models/app/pages/page-path-resolvability'
import { evaluateEmbeddedFormRefsAccess } from '@/presentation/render/forms/form-ref-access-check'
import {
  isContentDirSlugNotFound,
  resolveMarkdownPage,
} from '@/presentation/render/markdown/markdown-page-resolver'
import {
  extractSessionTimeout,
  shouldInjectAnalytics,
} from '@/presentation/render/page/analytics-helpers'
import { DefaultHomePage } from '@/presentation/render/page/default-home-page'
import {
  resolveComponentsCodeHighlights,
  resolvePageCodeHighlights,
} from '@/presentation/render/resolve/code-highlight-resolver'
import { highlightComponentCodeBlocks } from '@/presentation/render/resolve/component-code-highlighter'
import { expandMatchedPageReferences } from '@/presentation/render/resolve/component-reference-expansion'
import { stampTemplateIslands } from '@/presentation/render/resolve/data-source-rows'
import { resolveDerivedBreadcrumbs } from '@/presentation/render/resolve/derived-breadcrumb-resolver'
import { routeParamsAreServed } from '@/presentation/render/resolve/route-param-allow-list-resolver'
import { resolveSidebarCurrentEntries } from '@/presentation/render/resolve/sidebar-current-resolver'
import { resolvePageSidebar } from '@/presentation/render/resolve/sidebar-resolver'
import { resolveSidebarScopedEntries } from '../resolve/sidebar-scope-resolver'
import { rootRelativeFavicons, servedBelowRoot } from './favicon-address'
import {
  noopDb,
  resolveOverlayedSession,
  resolvePreRenderRedirect,
  toAccessDeniedResult,
} from './page-access-gating'
import { resolveCollectionAndFilter } from './page-collection-resolver'
import {
  renderPageHtml,
  resolveClientScriptPaths,
  resolveIslandAssets,
  type IslandBuilder,
} from './page-document-assembly'
import { pagePayloadForReader } from './page-payload-for-reader'
import { definedOnly } from './page-row-scope-resolver'
import { absolutizeSharingImage } from './sharing-image-address'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'
import type { SystemRowsFetcher } from '@/presentation/render/resolve/first-object-redirect-resolver'
import type { SystemRecordFetcher } from '@/presentation/render/resolve/page-system-record-binding'

/**
 * Whether an article gated by its own front matter admits the reader
 * — answered as for a page they may not open, after the page access passed.
 */
const articleAdmits = (
  markdownPayload: { readonly frontmatter: Readonly<Record<string, string>> } | undefined,
  app: App,
  session: SessionInfo | undefined
): boolean =>
  markdownPayload === undefined ||
  isArticleReadable(undefined, frontmatterAccess(markdownPayload.frontmatter), app, session)

/**
 * Renders a page by path to HTML string for server-side rendering
 *
 * Supports both static routes (exact match) and dynamic routes (with :param segments).
 * Enforces page access control before rendering.
 *
 * @param deps - Optional infrastructure dependencies (injected by PageRendererLive)
 */
// eslint-disable-next-line complexity, max-lines-per-function -- composed access guard (page access + formRef gate + landing redirect + collection resolution + permission overlay)
export async function renderPageByPath(
  app: App,
  path: string,
  options?: {
    readonly detectedLanguage?: string
    readonly session?: SessionInfo
    readonly cookies?: Readonly<Record<string, string>>
    readonly db?: DataSourceDb
    readonly islandBuilder?: IslandBuilder
    readonly previewMode?: boolean
    /** [internal ref] / a forms spec: host request query for embedded `$query` prefill. */
    readonly requestQuery?: Readonly<Record<string, string>>
    /**
     * G1: the scheme + host this request arrived on, feeding `$app.origin`.
     * Absent outside a request, where the token is left verbatim rather than
     * guessed.
     */
    readonly requestOrigin?: string
    /**
     * G1: the app whose OWN facts `$app.*` prints, when it is not the app being
     * rendered. A mounted embedded app renders its own preset pages, but the
     * name, version and brand a console must show are the OPERATOR's — a fact
     * the preset config cannot contain. Absent for a standalone app, where the
     * two are the same object.
     */
    readonly hostApp?: App
    /**
    /**
     * G2: the mount base every derived breadcrumb href hangs off. The path this
     * function receives has already had the base stripped, so the segments are
     * right and every href would otherwise point OUT of the mount — at a page of
     * the operator's app. Absent for a standalone app, where the base is empty.
     */
    readonly basePath?: string
    /**
     * G1: the version of the SOVRIUM ENGINE serving this render, feeding
     * `$app.engineVersion`. Resolved ONCE at boot and injected by the renderer
     * Layer, because it is a process constant rather than anything a request or
     * a config can vary. Under a mount it is deliberately NOT `$app.version`:
     * that one is the operator's own declared version, and the two must be free
     * to differ or the identity row says the same thing twice.
     */
    readonly engineVersion?: string
    /**
     * P3: server-side reader for a rows ENDPOINT, used only by
     * `page.redirectToFirst`. Supplied by the route layer, which is where the
     * request origin and the caller's cookies are known; absent, the redirect
     * does not fire and the page renders.
     */
    readonly fetchSystemRows?: SystemRowsFetcher
    /**
     * server-side record reader for a page-level `{ system }` binding,
     * borrowing the caller's credentials. Absent, the binding falls back to the
     * client-side enhancer marker.
     */
    readonly fetchSystemRecord?: SystemRecordFetcher
    /**
     * The `/:lang/` URL-prefix locale, when the request
     * carried one. Distinct from `detectedLanguage` (which also carries the
     * browser `Accept-Language` guess) because only the URL prefix outranks a
     * page's own `meta.lang`.
     */
    readonly urlLanguage?: string
    /**
     * P10/mount: the caller's resolved powers. A mounted console renders
     * session-less, so without this the capability gates are inert there — see
     * `holdsCapability` (`visibility-filter.ts`).
     */
    readonly callerCapabilities?: readonly CallerCapability[]
    /**
     * The path the visitor asked for, feeding `$app.path`. Absent, it is the
     * path being rendered; passed as `undefined`, the request named no single
     * address (a static 404) and the token is left verbatim.
     */
    readonly requestPath?: string | undefined
  }
): Promise<PageRenderResult> {
  const {
    detectedLanguage,
    session: rawSession,
    cookies,
    db,
    islandBuilder,
    previewMode,
    requestQuery,
    requestOrigin,
    hostApp,
    basePath,
    engineVersion,
    fetchSystemRows,
    fetchSystemRecord,
    urlLanguage,
    callerCapabilities,
  } = options ?? {}
  // Every page pass below reads the tree with its `{ component: name }`
  // references already inlined — see `component-reference-expansion.ts`.
  const found = expandMatchedPageReferences(findDeclaredPage(app, path), app.components)
  if (!found) return undefined
  const { page: matchedPage, params: routeParams, indexBasePathPattern } = found

  const session = await resolveOverlayedSession(rawSession, db)

  // Page access first, then a forms spec formRef gates (404 — S1).
  const denied = toAccessDeniedResult(checkPageAccess(matchedPage.access, app, session, path))
  if (denied !== false) return denied
  //
  // The pages route params specs shares this refusal, because it is the same
  // sentence: this address does not name a page for this caller. `page.params`
  // is the page's own statement of which URLs it serves, so it is answered
  // before anything is resolved, fetched or drawn — a segment outside the
  // declared set is not a page that renders empty, it is a page that was never
  // served, and 404 is what keeps the two from looking the same (S1). The set is
  // read AS THE CALLER, so a segment vouched for only by rows this visitor
  // cannot see is not vouched for at all; and `||` short-circuits, so a page
  // already refused above never spends the read.
  if (
    evaluateEmbeddedFormRefsAccess(app, matchedPage, session) === 'denied' ||
    !(await routeParamsAreServed(matchedPage, routeParams, fetchSystemRows))
  )
    return undefined

  // Both redirects that are decided BEFORE any rendering, in one step: the
  // post-login landing target, and the first-object answer to a bare collection
  // path. Grouped so this function stays under its statement cap and so the
  // "does this request render at all?" question reads as one decision.
  const preRenderRedirect = await resolvePreRenderRedirect({
    app,
    path,
    page: matchedPage,
    session,
    db,
    ...(fetchSystemRows !== undefined ? { fetchSystemRows } : {}),
  })
  if (preRenderRedirect !== undefined) return preRenderRedirect

  // Collection-page resolution is fused
  // with the standard component-filter pipeline so this entry function
  // stays under the project cyclomatic-complexity cap.
  const resolvedPage = await resolveCollectionAndFilter({
    matchedPage,
    app,
    routeParams,
    session,
    cookies,
    db: db ?? noopDb,
    previewMode: previewMode === true,
    // G1: `''` is an ANSWER here, not a guess, and this is the only frame that
    // can say so. Every mount passes its own base explicitly (see
    // `mounted-app-routes.ts`), so an absent one at this point is a standalone
    // app served at the site root — whose base is the empty string. Defaulting
    // any deeper would let a mounted page that was simply never threaded the
    // value print a root-relative address: well-formed, into the OPERATOR's own
    // app, and a 404 — which is why `resolveAppVarValues` leaves an absent base
    // verbatim rather than blank.
    basePath: basePath ?? '',
    // The optional members in one bag — `exactOptionalPropertyTypes` makes each
    // an `...(x !== undefined ? { x } : {})` spread, and that many of them
    // inline is most of this function's cognitive-complexity budget spent on
    // the same mechanical shape repeated.
    //
    // `engineVersion` belongs in the bag rather than beside `basePath` above:
    // it has no `?? ''` to apply, because an absent engine version is a wiring
    // fault and the surviving literal is how it gets noticed.
    ...definedOnly({
      hostApp,
      requestOrigin,
      engineVersion,
      fetchSystemRows,
      fetchSystemRecord,
      detectedLanguage,
      requestQuery,
      urlLanguage,
      callerCapabilities,
      requestPath: options !== undefined && 'requestPath' in options ? options.requestPath : path,
    }),
  })
  if (resolvedPage === undefined) return undefined
  if ('unauthorized' in resolvedPage) return { unauthorized: true }
  // P5: turn every `derive: 'path'` breadcrumb into a concrete trail while the
  // REQUEST path is still in hand — the component dispatcher never sees it.
  // G2 then G3: both need the REQUEST path, which the component dispatcher
  // never sees — resolving here is what keeps the renderer free of a prop that
  // would be inert for every component but these two.
  //
  // G2b runs BEFORE G3 and is a separate pass for a reason: it can DELETE its
  // input, and a current-entry mark resolved onto a row the gate then removes
  // would be an `aria-current` in a document nobody can reach. Pruning first
  // also keeps both island call-sites honest — `resolveIslandAssets` and
  // `DynamicPage`'s `hasIslandComponents` are handed this same `page`, so they
  // see one tree and cannot disagree about whether a bundle is needed.
  //
  // G3 additionally takes the RAW request query — undefaulted, straight off
  // `c.req.query()`. An entry whose href declares `?category=…` is current only
  // when the reader actually carries it, so a page's `query` DEFAULTS must not
  // reach this pass or every filter row would mark itself on the unfiltered
  // page. G2b needs none of it: `showWhen.section` is a path.
  const page: Page = rootRelativeFavicons(
    resolveSidebarCurrentEntries(
      resolveSidebarScopedEntries(
        resolveDerivedBreadcrumbs(resolvedPage, path, basePath),
        path,
        basePath
      ),
      path,
      basePath,
      { requestQuery, languages: app.languages, detectedLanguage, urlLanguage }
    ),
    basePath ?? '',
    servedBelowRoot({ path, urlLanguage, basePath })
  )

  // Highlight every `code`
  // component BEFORE `renderToString`, so a block nested inside a `tabs` panel
  // survives the island's `renderToStaticMarkup` serialisation already
  // highlighted (a post-render splice cannot reach into an escaped attribute).
  const [
    resolvedSidebar,
    islandAssets,
    clientScriptPaths,
    markdownPayload,
    highlightedComponents,
    highlightedTemplates,
  ] = await Promise.all([
    resolvePageSidebar(page.layout?.sidebar, app, { session, cookies, db: db ?? noopDb }),
    resolveIslandAssets(page, app.components, islandBuilder),
    resolveClientScriptPaths(islandBuilder),
    resolveMarkdownPage(page, routeParams, app, detectedLanguage, indexBasePathPattern, (fm) =>
      isArticleReadable(undefined, frontmatterAccess(fm), app, session)
    ),
    resolvePageCodeHighlights(
      page.components,
      app.design?.codeBlock?.theme,
      app.design?.codeBlock?.darkTheme
    ),
    // A list placed through `{ component: name }` is stamped in its TEMPLATE,
    // since the renderer expands the reference from this list, not from the page.
    resolveComponentsCodeHighlights(
      stampTemplateIslands(app.components, { app, routeParams }),
      app.design?.codeBlock?.theme,
      app.design?.codeBlock?.darkTheme
    ),
  ])

  // A contentDir page whose requested slug has no
  // backing markdown file (in an existing collection directory) is a genuine
  // not-found — return undefined so the caller renders the 404 not-found page
  // instead of an empty 200 article shell. Checked AFTER the parallel resolve
  // (instead of as a pre-flight read) so the hot path reads the article file
  // once; the discriminator only re-reads on the rare no-payload branch, and
  // is a constant `false` for non-contentDir pages.
  if (
    (markdownPayload === undefined && (await isContentDirSlugNotFound(page, routeParams))) ||
    !articleAdmits(markdownPayload, app, session)
  )
    return undefined
  const pageHtml = renderPageHtml({
    app,
    page: { ...page, components: highlightedComponents },
    appComponents: highlightedTemplates,
    routeParams,
    detectedLanguage,
    urlLanguage,
    islandEntryFile: islandAssets.entryFile,
    clientScriptPaths,
    islandPreloadHrefs: islandAssets.preloadHrefs,
    resolvedSidebar,
    markdownPayload,
    session,
  })
  // A standalone `code` component emits a synchronous
  // pre-highlight placeholder (Shiki's dynamic import can't run inside
  // `renderToString`). This async pass splices in the Shiki class-based markup,
  // reading the palette from `design.codeBlock` — both halves of it, when the
  // app named a dark counterpart. A no-op for pages without `code` components.
  // The one filter over every island payload: nothing names a field the
  // reader may not read, whichever renderer serialised it.
  const readerHtml = await pagePayloadForReader(pageHtml, { app, session, db })
  return highlightComponentCodeBlocks(
    absolutizeSharingImage(readerHtml, requestOrigin),
    app.design?.codeBlock?.theme,
    app.design?.codeBlock?.darkTheme
  )
}

/**
 * Renders any page by path to HTML string for server-side rendering
 *
 * For the homepage ('/'), falls back to a default homepage when no custom page is configured.
 * For all other paths, returns undefined if no matching page is found.
 *
 * @param app - Validated application data from AppSchema
 * @param path - Page path to render (e.g., '/', '/about')
 * @param detectedLanguage - Optional detected language from Accept-Language header
 * @returns Complete HTML document as string with DOCTYPE, or undefined if page not found
 */
export async function renderPage(
  app: App,
  path: string,
  options?: {
    readonly detectedLanguage?: string
    readonly session?: SessionInfo
    readonly cookies?: Readonly<Record<string, string>>
    readonly db?: DataSourceDb
    readonly islandBuilder?: IslandBuilder
    readonly previewMode?: boolean
    /** [internal ref] / a forms spec: host request query for embedded `$query` prefill. */
    readonly requestQuery?: Readonly<Record<string, string>>
    /** G1: scheme + host this request arrived on, feeding `$app.origin`. */
    readonly requestOrigin?: string
    /**
     * G1: the app whose OWN facts `$app.*` prints, when it is not the app being
     * rendered. A mounted embedded app renders its own preset pages, but the
     * name, version and brand a console must show are the OPERATOR's — a fact
     * the preset config cannot contain. Absent for a standalone app, where the
     * two are the same object.
     */
    readonly hostApp?: App
    /** G2: mount base every derived breadcrumb href hangs off. */
    readonly basePath?: string
    /** G1: the running engine's version, feeding `$app.engineVersion`. */
    readonly engineVersion?: string
    /** P3: server-side rows reader for `page.redirectToFirst`. */
    readonly fetchSystemRows?: SystemRowsFetcher
    /** server-side record reader for a page-level `{ system }` binding. */
    readonly fetchSystemRecord?: SystemRecordFetcher
    /** The `/:lang/` URL-prefix locale, when present. */
    readonly urlLanguage?: string
    /**
     * P10/mount: the caller's resolved powers. A mounted console renders
     * session-less, so without this the capability gates are inert there — see
     * `holdsCapability` (`visibility-filter.ts`).
     */
    readonly callerCapabilities?: readonly CallerCapability[]
    /**
     * The path the visitor asked for, feeding `$app.path`. Absent, it is the
     * path being rendered; passed as `undefined`, the request named no single
     * address (a static 404) and the token is left verbatim.
     */
    readonly requestPath?: string | undefined
  }
): Promise<PageRenderResult> {
  const result = await renderPageByPath(app, path, options)
  if (result) return result

  if (shouldServeDefaultHomePage(app, path, options)) {
    const injectAnalytics = shouldInjectAnalytics(app.analytics, '/')
    const defaultSessionTimeout = extractSessionTimeout(app.analytics)
    const html = renderToString(
      <DefaultHomePage
        app={app}
        builtInAnalyticsEnabled={injectAnalytics}
        builtInAnalyticsSessionTimeout={defaultSessionTimeout}
      />
    )
    return `<!DOCTYPE html>\n${html}`
  }

  return undefined
}

/**
 * Whether `/` falls back to the engine's placeholder homepage.
 *
 * Only for a standalone app that declares NO page at `/`. An app that declares
 * one has said what its homepage is, so when that page refuses to render — its
 * page-level record is unreadable for this caller, say — the honest answer is
 * the ordinary 404, the same one any other record-bound page gives. Serving
 * the placeholder instead turns a data refusal into a 200 that prints the
 * app's name, version and description as if they were the homepage.
 *
 * A mounted app never falls back either: its placeholder could only print the
 * embedded preset's own identity, which no operator configured. The mount
 * answers with its own not-found.
 */
function shouldServeDefaultHomePage(
  app: App,
  path: string,
  options: { readonly hostApp?: App; readonly basePath?: string } | undefined
): boolean {
  if (path !== '/') return false
  if (options?.hostApp !== undefined || options?.basePath !== undefined) return false
  return findDeclaredPage(app, '/') === undefined
}
