/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a derived trail is built beyond its segments.
 *
 * `basePath` is what makes the trail work under a MOUNT. The renderer receives
 * a path already stripped of the mount base, so the segments are right and
 * every href would be wrong — `/_admin/data/tables` would derive a crumb
 * linking to `/data`, which is a page of the operator's app rather than of the
 * console. Prefixing here keeps one derivation for both cases: a standalone app
 * passes no base and the prefix is empty.
 */
export interface DerivedCrumbOptions {
  /** The root crumb prepended ahead of the derived segments, when declared. */
  readonly home?: { readonly label: string }
  /** Mount base every href hangs off; empty for a standalone app. */
  readonly basePath?: string
  /**
   * Path segments (as they appear in the URL, before relabelling) whose crumb
   * keeps its label but carries no `href` — a prefix that answers no page.
   */
  readonly unlinked?: readonly string[]
  /**
   * The label of the LAST crumb, in place of its URL segment — a record page's
   * own name (`ORD-0412`) instead of its id. Ignored when empty.
   */
  readonly currentLabel?: string
  /**
   * The page's DECLARED path (`/templates/:path*`). When its last segment is a
   * catch-all (`:name*`), every request segment from that position on is one
   * capture, and the capture becomes ONE crumb rather than a crumb per folder.
   */
  readonly pattern?: string
}

/** One crumb of a derived trail. The last one carries no `href`. */
export interface DerivedCrumb {
  readonly label: string
  readonly href?: string
}

/** A label with something in it, trimmed, or `undefined`. */
const nonEmpty = (label: string | undefined): string | undefined => {
  const trimmed = label?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}

/**
 * Build a breadcrumb trail from the REQUEST path: one crumb per segment, each
 * linking to its own prefix, the last left without an `href` so the renderer
 * marks it `aria-current="page"` instead of linking the page to itself.
 *
 * This is what stops a breadcrumb being copy-pasted per page. The hierarchy is
 * already stated in the URL, so an enumerated trail restates it — and a
 * `:param` route cannot state it at all, because the last crumb differs per
 * request.
 *
 * `labels` relabels a segment, because a URL segment is a slug and
 * `data-tables` reads badly in page chrome. A segment with no entry falls back
 * to ITSELF, verbatim — deliberately not title-cased. That keeps the map
 * optional rather than exhaustive, and keeps a dynamic segment (an operator's
 * own table name) showing exactly what the operator named it, which a casing
 * rule would silently corrupt.
 *
 * Pure: no I/O and no request object — just the matched path string.
 *
 * @example
 * ```ts
 * buildDerivedCrumbs('/data/tables/customers', { data: 'Data', tables: 'Tables' })
 * // [ { label: 'Data', href: '/data' },
 * //   { label: 'Tables', href: '/data/tables' },
 * //   { label: 'customers' } ]
 *
 * buildDerivedCrumbs('/data', undefined, { home: { label: 'Ops' }, basePath: '/ops' })
 * // [ { label: 'Ops', href: '/ops' }, { label: 'data' } ]
 *
 * buildDerivedCrumbs('/automations/runs/42', { runs: 'Run' }, { unlinked: ['runs'] })
 * // [ { label: 'automations', href: '/automations' },
 * //   { label: 'Run' },
 * //   { label: '42' } ]
 *
 * buildDerivedCrumbs('/templates/emails/body.html', undefined, { pattern: '/templates/:path*' })
 * // [ { label: 'templates', href: '/templates' }, { label: 'body.html' } ]
 * ```
 */
export function buildDerivedCrumbs(
  path: string,
  labels: Readonly<Record<string, string>> | undefined,
  options: DerivedCrumbOptions = {}
): readonly DerivedCrumb[] {
  const base = options.basePath ?? ''
  const current = nonEmpty(options.currentLabel)
  const { staticSegments, captured } = splitAtCatchAll(
    splitSegments(path.split('?')[0] ?? ''),
    options.pattern
  )
  const hasCapture = captured !== undefined
  const staticCrumbs = buildStaticCrumbs(staticSegments, labels, {
    base,
    unlinked: new Set(options.unlinked),
    // The current-page label lands on the last STATIC crumb only when nothing
    // was captured after it; otherwise the capture is the current page.
    current: hasCapture ? undefined : current,
    lastIsCurrent: !hasCapture,
  })
  // `labels` and `unlinked` name STATIC segments: a captured one is data (an
  // asset's own file name), shown verbatim.
  const derived = hasCapture ? [...staticCrumbs, { label: current ?? captured }] : staticCrumbs
  return withHome(derived, options.home, base)
}

/**
 * Prepend the declared root crumb, if any.
 *
 * The root href is never authored: under a mount the app root is the MOUNT
 * (`/_admin`, `/ops`), which the config cannot know and only this call
 * resolves. An authored `/` would link every mounted console out of the mount
 * the operator was browsing.
 */
const withHome = (
  derived: readonly DerivedCrumb[],
  home: DerivedCrumbOptions['home'],
  base: string
): readonly DerivedCrumb[] =>
  home === undefined ? derived : [{ label: home.label, href: base === '' ? '/' : base }, ...derived]

interface StaticCrumbContext {
  readonly base: string
  readonly unlinked: ReadonlySet<string>
  readonly current: string | undefined
  readonly lastIsCurrent: boolean
}

/** One crumb per static segment, each linking to its own prefix. */
const buildStaticCrumbs = (
  segments: readonly string[],
  labels: Readonly<Record<string, string>> | undefined,
  context: StaticCrumbContext
): readonly DerivedCrumb[] =>
  segments.map((segment, index) => {
    const isLast = context.lastIsCurrent && index === segments.length - 1
    const label = (isLast ? context.current : undefined) ?? labels?.[segment] ?? segment
    // The prefix is rebuilt from the ORIGINAL segments, not the labelled ones —
    // a relabelled crumb must still link to the path it came from.
    // An unlinked segment is matched on the URL segment too, so the name in
    // config is the slug a person reads in the address bar, not its label.
    return isLast || context.unlinked.has(segment)
      ? { label }
      : { label, href: `${context.base}/${segments.slice(0, index + 1).join('/')}` }
  })

/**
 * Split the request segments at the declared catch-all, if any.
 *
 * A catch-all's capture is ONE value that happens to contain slashes: its
 * folders are not pages, so a crumb each would link into the catch-all itself,
 * borrowing whatever label a static segment of the same name has. `captured`
 * is the capture's LAST segment, or `undefined` when there is no catch-all or
 * it captured nothing — a zero-segment capture adds no crumb.
 */
const splitAtCatchAll = (
  segments: readonly string[],
  pattern: string | undefined
): { readonly staticSegments: readonly string[]; readonly captured: string | undefined } => {
  const at = catchAllIndex(pattern)
  if (at === undefined) return { staticSegments: segments, captured: undefined }
  return { staticSegments: segments.slice(0, at), captured: segments.slice(at).at(-1) }
}

const splitSegments = (path: string): readonly string[] =>
  path.split('/').filter((segment) => segment.length > 0)

/** Position of a trailing `:name*` segment in a declared path, if it has one. */
const catchAllIndex = (pattern: string | undefined): number | undefined => {
  if (pattern === undefined) return undefined
  const segments = splitSegments(pattern)
  const last = segments[segments.length - 1]
  return last !== undefined && /^:[^/]+\*$/.test(last) ? segments.length - 1 : undefined
}
