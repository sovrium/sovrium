/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `classifyPageCacheability` — pure Domain verdict deciding whether a page's
 * rendered HTML can be served from the static page-output cache
 * (`ECO_PAGE_CACHE`), and if
 * so under which cache key.
 *
 * ## Safety model
 *
 * The page cache is consulted ONLY for anonymous requests. The renderer's
 * session-dependent steps — visibility filtering, CRUD-permission filtering,
 * OAuth filtering (see `presentation/render/resolve/visibility-filter.ts` and
 * `render-page.tsx`) — are all pure functions of `(schema, session)`. With
 * `session === undefined` they produce deterministic output, so they do NOT
 * make a page uncacheable.
 *
 * The only remaining sources of per-request variation are reads from OUTSIDE
 * the schema — the database and the filesystem — because their content can
 * change without the app render-checksum changing. Everything else (theme,
 * `$ref` expansion, `$vars` substitution, island SSR skeletons) is a pure
 * function of the schema and is already covered by the render-checksum cache
 * key.
 *
 * ## What the verdict reads: the page AS RENDERED, not as authored
 *
 * A component placed through `$ref` / `component` is a pointer into
 * `app.components`, and a breakpoint's `responsive.<bp>.children` is a second
 * child list beside `children`. The renderer expands and draws both, so every
 * per-request signal below is looked for there too — templates at any depth,
 * guarded against a template that (directly or through another) places itself.
 * Reading only the authored tree once let a template's record list or
 * query-prefilled form be served from a copy stored for another visitor.
 *
 * ## Three-way verdict
 *
 * | Verdict     | Meaning                                                       |
 * | ----------- | ------------------------------------------------------------- |
 * | `'static'`  | Request-invariant. Cached under the render-checksum key alone. |
 * | `'content'` | Corpus-invariant. Its ONLY out-of-schema input is a directory  |
 * |             | of markdown files, so it is cached under the render-checksum   |
 * |             | key EXTENDED by a corpus checksum the route layer computes.    |
 * | `'dynamic'` | Anything else — never cached.                                  |
 *
 * The `'content'` verdict is deliberately narrow: it requires an actual
 * `contentDir` (there must be a corpus to measure) AND that every tripped
 * dynamic signal is one of the filesystem-backed set
 * ({@link CONTENT_BACKED_SIGNALS}). A `:param` page with no `contentDir` has
 * nothing to checksum and stays `'dynamic'`, and a `layout.sidebar` page stays
 * `'dynamic'` because `SidebarItem.dataSource` is REQUIRED — it is a database
 * read a corpus checksum can never observe.
 *
 * A `source` single-file markdown page also stays `'dynamic'`. The same
 * corpus-checksum argument would apply to its degenerate one-file corpus, but
 * its resolution path (no collection nav, no slug derivation) differs enough
 * that it is a deliberate follow-up rather than a half-covered case.
 */

import { findMatchingRoute } from '@/domain/kernel/matching/route-matcher'
import { NOW_TOKEN } from '@/domain/kernel/time/now-token'
import { isOpenToEveryone, toPermissionValue } from '@/domain/models/app/auth/permission-evaluation'
import { APP_ORIGIN_TOKEN } from '@/domain/models/app/pages/app-vars'
import {
  placedTemplatesOf,
  someRenderedNode,
  type PlacedTemplates,
  type Templates,
  type TreeNode,
} from '@/domain/models/app/pages/component-tree-has-type'
import { readEmbeddedFormRef } from '@/domain/models/app/pages/embedded-form-ref'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { Page } from '@/domain/models/app/pages'

type Node = TreeNode

/**
 * Returns true when `page.access` gates the page to non-anonymous users. An
 * anonymous request to such a page is denied/redirected rather than rendered,
 * so there is no cacheable HTML body. Any `access` value other than the
 * public `'all'` (string form, role-array form, or object form) is a gate.
 */
const hasNonPublicAccess = (access: Page['access']): boolean =>
  access !== undefined && !isOpenToEveryone(toPermissionValue(access))

/**
 * The cacheability verdict for a page — see the module header for the full
 * decision table.
 */
export type PageCacheability = 'static' | 'content' | 'dynamic'

/**
 * Identifiers for the page-level signals that make a page's HTML vary per
 * request. Naming them (rather than keeping an anonymous predicate list) is
 * what lets the `'content'` verdict ask WHICH signals tripped, not just how
 * many.
 */
type DynamicSignalId =
  | 'access'
  | 'collection'
  | 'dataSource'
  | 'contentDir'
  | 'source'
  | 'markdown'
  | 'presence'
  | 'invitation'
  | 'sidebar'
  | 'paramPath'
  | 'appOrigin'

/**
 * Page-level signals that make a page's HTML vary per request — each reads the
 * database or filesystem, enables a real-time feature, gates by session, or
 * carries a dynamic route parameter. A page with any of these is not `'static'`.
 */
const DYNAMIC_PAGE_SIGNALS: readonly {
  readonly id: DynamicSignalId
  readonly trips: (page: Page, placed: PlacedTemplates) => boolean
}[] = [
  { id: 'access', trips: (page) => hasNonPublicAccess(page.access) },
  { id: 'collection', trips: (page) => page.collection !== undefined },
  { id: 'dataSource', trips: (page) => page.dataSource !== undefined },
  { id: 'contentDir', trips: (page) => page.contentDir !== undefined },
  { id: 'source', trips: (page) => page.source !== undefined },
  { id: 'markdown', trips: (page) => page.markdown !== undefined },
  { id: 'presence', trips: (page) => page.presence === true },
  // `page.invitation` prints who invited whom from the token in the address,
  // and withdraws the answer forms once it is answered — never shareable.
  { id: 'invitation', trips: (page) => page.invitation !== undefined },
  { id: 'sidebar', trips: (page) => page.layout?.sidebar !== undefined },
  { id: 'paramPath', trips: (page) => page.path.includes(':') },
  // G1: `$app.origin` prints the address THIS request arrived on. The page
  // cache is keyed by path, so serving a second front host from an entry minted
  // for the first would print the wrong address to every one of its visitors.
  { id: 'appOrigin', trips: (page, placed) => referencesRequestOrigin(page, placed) },
]

/**
 * Whether any string the page carries — or any template it places — references
 * `$app.origin`.
 *
 * A deep scan rather than a shallow one because the token is usable anywhere a
 * string is — a heading, a prop, an `href`, a breadcrumb label. The page's own
 * scan also covers a reference's `vars`; the scan of each placed template covers
 * the body those vars are substituted into. Each string is visited once.
 */
function referencesRequestOrigin(page: Page, placed: PlacedTemplates): boolean {
  return (
    hasOriginToken(page.components) || hasOriginToken(page.layout) || placed.some(hasOriginToken)
  )
}

function hasOriginToken(value: unknown): boolean {
  if (typeof value === 'string') return value.includes(APP_ORIGIN_TOKEN)
  if (Array.isArray(value)) return value.some(hasOriginToken)
  if (value === null || typeof value !== 'object') return false
  return Object.values(value).some(hasOriginToken)
}

/**
 * The signals a `'content'` page is allowed to trip — the filesystem-backed
 * set a per-request corpus checksum of the page's `contentDir` fully observes.
 *
 * `sidebar` is deliberately ABSENT: `SidebarItem.dataSource` is required, so a
 * `layout.sidebar` is database-backed navigation whose rows a corpus checksum
 * cannot see. `source` is absent as the documented single-file follow-up.
 */
const CONTENT_BACKED_SIGNALS: ReadonlySet<DynamicSignalId> = new Set<DynamicSignalId>([
  'contentDir',
  'markdown',
  'paramPath',
])

/**
 * Whether any rendered node carries a `dataSource` binding. A component-level
 * `dataSource` makes the renderer read the database for that component, so its
 * HTML is not checksum-invariant and the host page must not be cached.
 */
const componentTreeHasDataSource = (items: readonly unknown[], placed: PlacedTemplates): boolean =>
  someRenderedNode(items, placed, (node) => node['dataSource'] !== undefined)

/**
 * The signals that read RECORD data — a table or a system endpoint — rather
 * than the filesystem, the request, or the session. Together with a
 * component-level `dataSource` (see {@link readsRecordData}) they mark the
 * `'dynamic'` pages whose bytes change when someone writes a record.
 */
const RECORD_BACKED_SIGNALS: ReadonlySet<DynamicSignalId> = new Set<DynamicSignalId>([
  'collection',
  'dataSource',
  'invitation',
  'sidebar',
])

/**
 * Whether the page, as rendered, reads record data: a component (at any
 * depth, through a template or a breakpoint) binds a `dataSource`, or the page
 * trips one of the {@link RECORD_BACKED_SIGNALS}. Not a new verdict — the same
 * signals {@link verdictFor} already reads, asked which family tripped.
 */
const readsRecordData = (page: Page, placed: PlacedTemplates): boolean =>
  componentTreeHasDataSource(page.components ?? [], placed) ||
  DYNAMIC_PAGE_SIGNALS.some(
    (signal) => RECORD_BACKED_SIGNALS.has(signal.id) && signal.trips(page, placed)
  )

/** {@link classifyPageCacheability} over templates already collected. */
const verdictFor = (page: Page, placed: PlacedTemplates): PageCacheability => {
  if (componentTreeHasDataSource(page.components ?? [], placed)) return 'dynamic'
  const tripped = DYNAMIC_PAGE_SIGNALS.filter((signal) => signal.trips(page, placed))
  if (tripped.length === 0) return 'static'
  if (page.contentDir === undefined) return 'dynamic'
  return tripped.every((signal) => CONTENT_BACKED_SIGNALS.has(signal.id)) ? 'content' : 'dynamic'
}

/**
 * Decide how a page's rendered HTML may be cached.
 *
 * `'static'` when it trips no {@link DYNAMIC_PAGE_SIGNALS} and no component (at
 * any depth) has a `dataSource` binding; `'content'` when it owns a
 * `contentDir` and every tripped signal is in {@link CONTENT_BACKED_SIGNALS};
 * `'dynamic'` otherwise.
 *
 * Pure: this only classifies. Measuring the corpus (a filesystem read) belongs
 * to the infrastructure layer.
 *
 * @param page - The page schema object, as authored (references unexpanded).
 * @param templates - `app.components`, which the page's references name.
 */
export const classifyPageCacheability = (page: Page, templates: Templates = []): PageCacheability =>
  verdictFor(page, placedTemplatesOf(page.components ?? [], templates))

/**
 * True when a prefill or default value is resolved from the REQUEST rather than
 * the schema: `$query.<name>` (the URL) or `$now` (the moment of the render).
 * `$user.<prop>` is deliberately absent — the page cache only ever serves
 * anonymous requests, for which it resolves to nothing, identically every time.
 */
const isRequestValue = (value: unknown): boolean =>
  typeof value === 'string' && (value.startsWith('$query.') || value === NOW_TOKEN)

/**
 * True when a form starts from a request-dependent value: its form-level
 * `prefill`, or one of its fields' `defaultValue`s (an embedded form starts
 * from both, exactly as its standalone page does). Such a form renders
 * per-request initial values, so a page embedding it (via `formRef`) is not
 * safe to serve from the path-keyed page cache.
 */
const formHasRequestPrefill = (form: Readonly<Form>): boolean => {
  const { prefill } = form as { readonly prefill?: Readonly<Record<string, unknown>> }
  if (prefill !== undefined && Object.values(prefill).some(isRequestValue)) return true
  const fields = (form as { readonly fields?: readonly unknown[] }).fields ?? []
  return fields.some((field) =>
    isRequestValue((field as { readonly defaultValue?: unknown } | null)?.defaultValue)
  )
}

/** True when a page-form node's own `inlinePrefill` names a request-dependent value. */
function inlinePrefillReadsRequest(node: Node): boolean {
  const { inlinePrefill } = node as { readonly inlinePrefill?: { readonly prefill?: unknown } }
  const prefill = inlinePrefill?.prefill
  if (prefill === null || typeof prefill !== 'object') return false
  return Object.values(prefill).some(isRequestValue)
}

/**
 * True when a single component node renders request-dependent starting values:
 * its own `inlinePrefill` does, or it embeds (`formRef`) a form that does.
 *
 * The embedded form is read through {@link readEmbeddedFormRef}, the one
 * predicate the router's embedded-form gate and the page-search corpus also
 * ask, so a component kind that gains `formRef` joins this verdict the moment
 * its schema declares the key rather than when someone remembers this list.
 */
function nodeRendersRequestPrefill(node: Node, forms: readonly Form[]): boolean {
  if (inlinePrefillReadsRequest(node)) return true
  const formRef = readEmbeddedFormRef(node)
  if (formRef === undefined) return false
  const form = forms.find((candidate) => candidate.name === formRef)
  return form !== undefined && formHasRequestPrefill(form)
}

/**
 * Whether any rendered `form` / `dialog` node — inline, inside a placed
 * template, or only in a breakpoint's children — renders request-dependent
 * starting values (a forms spec: `$query.*`; `$now`). Such a page's form
 * renders differently per request, so its HTML is not request-invariant.
 */
const componentTreeHasRequestPrefillForm = (
  items: readonly unknown[],
  forms: readonly Form[],
  placed: PlacedTemplates
): boolean => someRenderedNode(items, placed, (node) => nodeRendersRequestPrefill(node, forms))

/**
 * How the page that would render for `path` may be cached, paired with the
 * matched page so the route layer can reach its `contentDir` when the verdict
 * is `'content'` (it needs the directory to checksum).
 */
export interface RenderablePathCacheability {
  readonly verdict: PageCacheability
  /** The matched page, or `undefined` for the implicit default homepage. */
  readonly page: Page | undefined
  /**
   * Whether the page reads record data (a table or a system endpoint). Always
   * `false` for a `'static'` or `'content'` verdict; on a `'dynamic'` one it
   * separates a page whose bytes change when a record is written from one that
   * varies only with its URL, its request or its session.
   */
  readonly readsRecordData: boolean
}

/** The verdict for a path that resolves to no authored page. */
const unmatched = (path: string): RenderablePathCacheability => ({
  verdict: path === '/' ? 'static' : 'dynamic',
  page: undefined,
  readsRecordData: false,
})

/**
 * Classify how the page that would render for `path` may be cached.
 *
 * Combines route matching (`findMatchingRoute`) with
 * {@link classifyPageCacheability}. The default homepage — `/` with no authored
 * page — is `'static'` because `DefaultHomePage` is fully static. Any unmatched
 * non-`/` path is `'dynamic'` (it renders a 404, which is never stored).
 *
 * @param app - The application schema.
 * @param path - The request path passed to the renderer.
 */
export function classifyRenderablePath(app: App, path: string): RenderablePathCacheability {
  const { pages } = app
  if (!pages || pages.length === 0) return unmatched(path)

  const match = findMatchingRoute(
    pages.map((page) => page.path),
    path
  )
  if (!match) return unmatched(path)

  const page = pages[match.index]
  if (!page) return unmatched(path)
  // [internal ref] / a forms spec: a page whose form starts from `$query.*` or `$now`
  // (its prefill, its fields' defaults, or the host's inline prefill) renders
  // per-request output. The page cache is keyed by path only (no query string)
  // and has no TTL, so serving such a page from cache would leak a prior
  // request's `?param` values, or freeze `$now` — exclude it.
  const placed = placedTemplatesOf(page.components ?? [], app.components ?? [])
  const readsRecords = readsRecordData(page, placed)
  if (componentTreeHasRequestPrefillForm(page.components ?? [], app.forms ?? [], placed)) {
    return { verdict: 'dynamic', page, readsRecordData: readsRecords }
  }
  return { verdict: verdictFor(page, placed), page, readsRecordData: readsRecords }
}
