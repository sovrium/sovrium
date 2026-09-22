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
}

/** One crumb of a derived trail. The last one carries no `href`. */
export interface DerivedCrumb {
  readonly label: string
  readonly href?: string
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
 * ```
 */
export function buildDerivedCrumbs(
  path: string,
  labels: Readonly<Record<string, string>> | undefined,
  options?: DerivedCrumbOptions
): readonly DerivedCrumb[] {
  const base = options?.basePath ?? ''
  const segments = (path.split('?')[0] ?? '').split('/').filter((segment) => segment.length > 0)

  const derived = segments.map((segment, index) => {
    const label = labels?.[segment] ?? segment
    const isLast = index === segments.length - 1
    // The prefix is rebuilt from the ORIGINAL segments, not the labelled ones —
    // a relabelled crumb must still link to the path it came from.
    return isLast ? { label } : { label, href: `${base}/${segments.slice(0, index + 1).join('/')}` }
  })

  const { home } = options ?? {}
  if (home === undefined) return derived
  // The root href is never authored: under a mount the app root is the MOUNT
  // (`/_admin`, `/ops`), which the config cannot know and only this call
  // resolves. An authored `/` would link every mounted console out of the mount
  // the operator was browsing.
  return [{ label: home.label, href: base === '' ? '/' : base }, ...derived]
}
