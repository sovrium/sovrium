/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `isPageCacheable` — pure Domain predicate deciding whether a page's rendered
 * HTML is request-invariant and therefore safe to serve from the static
 * page-output cache (`ECO_PAGE_CACHE`, see
 * `[internal ref]`).
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
 * change without the app render-checksum changing. This predicate therefore
 * excludes exactly the pages that trigger such reads. Everything else (theme,
 * `$ref` expansion, `$vars` substitution, island SSR skeletons) is a pure
 * function of the schema and is already covered by the render-checksum cache
 * key.
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
 * Page-level signals that make a page's HTML vary per request — each reads the
 * database or filesystem, enables a real-time feature, gates by session, or
 * carries a dynamic route parameter. A page with any of these is not cacheable.
 */
const DYNAMIC_PAGE_SIGNALS: readonly ((page: Page) => boolean)[] = [
  (page) => hasNonPublicAccess(page.access),
  (page) => page.collection !== undefined,
  (page) => page.dataSource !== undefined,
  (page) => page.contentDir !== undefined,
  (page) => page.source !== undefined,
  (page) => page.markdown !== undefined,
  (page) => page.presence === true,
  (page) => page.layout?.sidebar !== undefined,
  (page) => page.path.includes(':'),
]

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
 * Decide whether a page's rendered HTML is request-invariant and safe to
 * cache. A page is cacheable only when it carries no {@link DYNAMIC_PAGE_SIGNALS}
 * and no component (at any depth) has a `dataSource` binding.
 *
 * @param page - The resolved page schema object.
 */
export const isPageCacheable = (page: Page): boolean =>
  !DYNAMIC_PAGE_SIGNALS.some((signal) => signal(page)) &&
  !componentTreeHasDataSource(page.components)

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
 * Whether the page that would render for `path` is safe to serve from the
 * static page-output cache.
 *
 * Combines route matching (`findMatchingRoute`) with {@link isPageCacheable}.
 * The default homepage — `/` with no authored page — is treated as cacheable
 * because `DefaultHomePage` is fully static. Any unmatched non-`/` path is not
 * cacheable (it renders a 404, which is never stored).
 *
 * @param app - The application schema.
 * @param path - The request path passed to the renderer.
 */
export function isRenderablePathCacheable(app: App, path: string): boolean {
  const { pages } = app
  if (!pages || pages.length === 0) return path === '/'

  const match = findMatchingRoute(
    pages.map((page) => page.path),
    path
  )
  if (!match) return path === '/'

  const page = pages[match.index]
  if (!page) return path === '/'
  // GAP-3 / [internal ref]: a page embedding a formRef form whose form-level
  // `prefill` reads `$query.*` renders query-dependent output. The page cache is
  // keyed by path only (no query string), so serving such a page from cache
  // would leak a prior request's `?param` values — exclude it.
  if (componentTreeHasQueryPrefillForm(page.components ?? [], app.forms ?? [])) return false
  return isPageCacheable(page)
}
