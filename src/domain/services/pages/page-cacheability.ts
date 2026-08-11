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
 * OAuth filtering (see `presentation/rendering/visibility-filter.ts` and
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

import { isOpenToEveryone, toPermissionValue } from '@/domain/models/shared/permission-evaluation'
import { findMatchingRoute } from '@/domain/utils/matching/route-matcher'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { Page } from '@/domain/models/app/pages'

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
  | 'sidebar'
  | 'paramPath'

/**
 * Page-level signals that make a page's HTML vary per request — each reads the
 * database or filesystem, enables a real-time feature, gates by session, or
 * carries a dynamic route parameter. A page with any of these is not `'static'`.
 */
const DYNAMIC_PAGE_SIGNALS: readonly {
  readonly id: DynamicSignalId
  readonly trips: (page: Page) => boolean
}[] = [
  { id: 'access', trips: (page) => hasNonPublicAccess(page.access) },
  { id: 'collection', trips: (page) => page.collection !== undefined },
  { id: 'dataSource', trips: (page) => page.dataSource !== undefined },
  { id: 'contentDir', trips: (page) => page.contentDir !== undefined },
  { id: 'source', trips: (page) => page.source !== undefined },
  { id: 'markdown', trips: (page) => page.markdown !== undefined },
  { id: 'presence', trips: (page) => page.presence === true },
  { id: 'sidebar', trips: (page) => page.layout?.sidebar !== undefined },
  { id: 'paramPath', trips: (page) => page.path.includes(':') },
]

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
 * Walks a component tree depth-first and reports whether any node carries a
 * `dataSource` binding. A component-level `dataSource` makes the renderer read
 * the database for that component, so its HTML is not checksum-invariant and
 * the host page must not be cached.
 *
 * Tree items may be a direct component object (which may own a `dataSource`
 * and nested `children`), a `$ref` / `component` reference (opaque — no
 * `dataSource` of its own), or a plain string (text child — never dynamic).
 */
function componentTreeHasDataSource(items: readonly unknown[]): boolean {
  return items.some((item) => {
    if (item === null || typeof item !== 'object') return false
    const node = item as Record<string, unknown>
    if ('$ref' in node || 'component' in node) return false
    if (node.dataSource !== undefined) return true
    const { children } = node
    return Array.isArray(children) ? componentTreeHasDataSource(children) : false
  })
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
 * @param page - The resolved page schema object.
 */
export const classifyPageCacheability = (page: Page): PageCacheability => {
  if (componentTreeHasDataSource(page.components ?? [])) return 'dynamic'
  const tripped = DYNAMIC_PAGE_SIGNALS.filter((signal) => signal.trips(page))
  if (tripped.length === 0) return 'static'
  if (page.contentDir === undefined) return 'dynamic'
  return tripped.every((signal) => CONTENT_BACKED_SIGNALS.has(signal.id)) ? 'content' : 'dynamic'
}

/**
 * True when a form's form-level `prefill` reads any `$query.*` reference. Such a
 * form renders query-dependent initial values, so a page embedding it (via
 * `formRef`) is not safe to serve from the path-keyed page cache.
 */
const formHasQueryPrefill = (form: Readonly<Form>): boolean => {
  const { prefill } = form as { readonly prefill?: Readonly<Record<string, unknown>> }
  if (prefill === undefined) return false
  return Object.values(prefill).some(
    (value) => typeof value === 'string' && value.startsWith('$query.')
  )
}

/**
 * True when a single component node embeds a `{ type: 'form' | 'dialog',
 * formRef: <name> }` referencing a form whose form-level `prefill` reads
 * `$query.*`. Split out of the tree walker to keep each function's cyclomatic
 * complexity within the project cap.
 */
function nodeEmbedsQueryPrefillForm(
  node: Record<string, unknown>,
  forms: readonly Form[]
): boolean {
  if (node.type !== 'form' && node.type !== 'dialog') return false
  if (typeof node.formRef !== 'string') return false
  const form = forms.find((candidate) => candidate.name === node.formRef)
  return form !== undefined && formHasQueryPrefill(form)
}

/**
 * Walk a component tree and report whether any `{ type: 'form' | 'dialog',
 * formRef: <name> }` node references a form whose form-level `prefill` reads
 * `$query.*`. Such a page's embedded form renders differently
 * per request query string, so its HTML is not request-invariant.
 */
function componentTreeHasQueryPrefillForm(
  items: readonly unknown[],
  forms: readonly Form[]
): boolean {
  return items.some((item) => {
    if (item === null || typeof item !== 'object') return false
    const node = item as Record<string, unknown>
    if ('$ref' in node || 'component' in node) return false
    if (nodeEmbedsQueryPrefillForm(node, forms)) return true
    const { children } = node
    return Array.isArray(children) ? componentTreeHasQueryPrefillForm(children, forms) : false
  })
}

/**
 * How the page that would render for `path` may be cached, paired with the
 * matched page so the route layer can reach its `contentDir` when the verdict
 * is `'content'` (it needs the directory to checksum).
 */
export interface RenderablePathCacheability {
  readonly verdict: PageCacheability
  /** The matched page, or `undefined` for the implicit default homepage. */
  readonly page: Page | undefined
}

/** The verdict for a path that resolves to no authored page. */
const unmatched = (path: string): RenderablePathCacheability => ({
  verdict: path === '/' ? 'static' : 'dynamic',
  page: undefined,
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
  // GAP-3 / [internal ref]: a page embedding a formRef form whose form-level
  // `prefill` reads `$query.*` renders query-dependent output. The page cache is
  // keyed by path only (no query string), so serving such a page from cache
  // would leak a prior request's `?param` values — exclude it.
  if (componentTreeHasQueryPrefillForm(page.components ?? [], app.forms ?? [])) {
    return { verdict: 'dynamic', page }
  }
  return { verdict: classifyPageCacheability(page), page }
}
