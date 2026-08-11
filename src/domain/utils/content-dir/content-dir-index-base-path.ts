/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared derivation of the collection BASE PATH a `contentDir.index` article is
 * served at: the page `path` minus its
 * trailing dynamic segment, e.g. `/en/docs/:slug` → `/en/docs` and
 * `/:slug` → `/` (an empty remainder normalizes to the root path).
 *
 * Consumed by BOTH the domain-layer `PagesSchema` cross-page conflict filter
 * (a sibling page must not already claim the base path) and, later, the
 * presentation-layer markdown-page engine that serves the index article at the
 * base path and 301-redirects its slugged URL. It lives in `domain/utils/` —
 * the pure, cross-layer home — because the derivation is a pure function of a
 * plain page-path string, with no I/O.
 *
 * Returns `undefined` when the path does NOT end in a dynamic segment
 * (`/:param` or `/:param*`) — the degenerate case where `contentDir.index`
 * has no base path to serve, so callers naturally fall through.
 */

/**
 * Trailing dynamic segment of a page path: `/:slug`, `/:path*`, … The single
 * capture group is the segment's PARAM NAME (`slug`, `path`), consumed by
 * {@link deriveTrailingDynamicParamName}. The whole match is the segment to
 * strip, consumed by {@link deriveContentDirIndexBasePath} — the capture group
 * is inert under an empty-string `.replace`, so one regex serves both.
 */
const TRAILING_DYNAMIC_SEGMENT = /\/:([^/]+?)\*?$/

export const deriveContentDirIndexBasePath = (path: string): string | undefined => {
  if (!TRAILING_DYNAMIC_SEGMENT.test(path)) return undefined
  const basePath = path.replace(TRAILING_DYNAMIC_SEGMENT, '')
  return basePath === '' ? '/' : basePath
}

/**
 * Name of a page path's trailing dynamic segment, e.g. `/docs/:slug` → `slug`,
 * `/:lang/docs/:path*` → `path`. Returns `undefined` when the path has no
 * trailing dynamic segment (mirrors {@link deriveContentDirIndexBasePath}
 * returning `undefined` for the same inputs) — the two derivations share the
 * single {@link TRAILING_DYNAMIC_SEGMENT} definition so "what the trailing
 * dynamic segment is" lives in exactly one place.
 */
export const deriveTrailingDynamicParamName = (path: string): string | undefined =>
  path.match(TRAILING_DYNAMIC_SEGMENT)?.[1]
