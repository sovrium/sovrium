/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared derivation of a `contentDir` article's URL slug from the route params
 * captured against its page pattern. Consumed by BOTH the presentation-layer
 * markdown-page resolver (HTML article route + collection-nav) and the
 * infrastructure-layer per-page `.md` export route
 *. It lives in `domain/utils/` — the pure,
 * cross-layer home — because the derivation is a pure function of a domain model
 * (`ContentDir.slugFrom`) plus plain route-param strings, with no I/O.
 *
 * Pure: no I/O, no dependencies on infrastructure. Co-located with the rest of
 * the frontmatter/contentDir-shape semantics (`matchesContentDirFilter`) so the
 * single source of truth stays together.
 */

import type { ContentDir } from '@/domain/models/app/pages/content-dir'

/**
 * Trim a leading `/` from an extracted slug so a downstream
 * `${directory}/${slug}.md` join does not collapse into an absolute path on
 * disk when a route param happens to start with one (defensive — the current
 * route-matcher captures already strip the slash, but keep the helper
 * self-contained).
 */
const stripLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value.slice(1) : value

/**
 * Derive a file-relative slug from the route params for a `contentDir` page.
 *
 * `slugFrom: 'filename'` (default) returns the first dynamic-segment value
 * verbatim — typical for `/blog/:slug` shapes where one column captures the
 * filename without `.md`.
 *
 * `slugFrom: 'filepath'` joins all dynamic-segment values with `/` so nested
 * directory shapes like `/docs/:section/:page` map to
 * `${directory}/${section}/${page}.md`. The route-matcher only captures one
 * non-slash chunk per `:` segment today, but the join semantics keep the
 * derivation future-proof for richer wildcard syntax (e.g. `:path*` once the
 * matcher learns to consume multi-segment paths).
 *
 * The `:lang` segment is a LANGUAGE PREFIX, not a content slug — a bilingual
 * collection route `/:lang/:slug` must map `/en/getting-started` to the
 * `getting-started` slug, NOT `en`. The `lang` route param is therefore
 * excluded from slug derivation ([internal ref] /
 * [internal ref]).
 *
 * Returns `undefined` when no content-bearing segment was captured so callers
 * can fall through (render an empty shell, or 404 the `.md` twin).
 */
export const deriveContentDirSlugFromRouteParams = (
  contentDir: ContentDir,
  routeParams: Readonly<Record<string, string>>
): string | undefined => {
  const values = Object.entries(routeParams)
    .filter(([key, value]) => key !== 'lang' && typeof value === 'string' && value.length > 0)
    .map(([, value]) => value)
  if (values.length === 0) return undefined
  if (contentDir.slugFrom === 'filepath') return stripLeadingSlash(values.join('/'))
  // `filename` mode: take the first available dynamic segment.
  const first = values[0]
  return first === undefined ? undefined : stripLeadingSlash(first)
}
