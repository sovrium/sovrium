/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared resolution of a `contentDir.index` request served at the collection
 * BASE PATH.
 *
 * When a collection page declares `contentDir.index`, its base path (the page
 * `path` minus its trailing dynamic segment) ALSO serves the named index
 * article. `/docs/:slug` + `index: 'introduction'` → the base path `/docs`
 * renders `introduction`, and `/:lang/docs/:slug` → `/en/docs` renders the
 * index under the `en` locale.
 *
 * This pure matcher returns, for a request path that equals such a base path,
 * the owning page, the base-path PATTERN (used to synthesise the canonical /
 * hreflang SEO at the base path rather than the slugged URL), and the
 * route-params to feed the existing slug-driven pipeline — the trailing
 * dynamic segment is pre-filled with the index slug so the markdown resolver,
 * collection-nav lister, and last-updated stamp all resolve the index file
 * unchanged. Returns `undefined` when no index-bearing collection claims the
 * path, so callers fall through to ordinary page resolution.
 *
 * Consumed by the presentation-layer page renderer (base-path serving), the
 * infrastructure-layer `.md`-export route (the base-path `.md`/`Accept` twin),
 * and the server-only index-redirect route. Lives in `domain/utils/` — the
 * pure, cross-layer home — because it is a pure function of the page configs
 * plus a plain request-path string, with no I/O.
 */

import { matchRoute, type RouteParams } from '@/domain/utils/matching/route-matcher'
import {
  deriveContentDirIndexBasePath,
  deriveTrailingDynamicParamName,
} from './content-dir-index-base-path'
import type { Page } from '@/domain/models/app/pages'

/** A request path resolved to a collection's index article at its base path. */
export interface ContentDirIndexBaseMatch {
  /** The owning `/docs/:slug` collection page. */
  readonly page: Page
  /** The base-path pattern (page path minus trailing dynamic segment), e.g. `/:lang/docs`. */
  readonly basePathPattern: string
  /** The `contentDir.index` slug served at the base path. */
  readonly indexSlug: string
  /**
   * Route params for the existing slug-driven pipeline: the base-path match
   * params (e.g. `{ lang: 'en' }`) with the trailing dynamic segment pre-filled
   * with the index slug (e.g. `{ lang: 'en', slug: 'introduction' }`).
   */
  readonly routeParams: RouteParams
}

/**
 * Resolve a request `path` against every index-bearing collection page's base
 * path. Returns the first match, or `undefined` when none applies.
 */
export const matchContentDirIndexBasePath = (
  pages: readonly Page[],
  path: string
): ContentDirIndexBaseMatch | undefined =>
  pages
    .map((page): ContentDirIndexBaseMatch | undefined => {
      const indexSlug = page.contentDir?.index
      if (indexSlug === undefined) return undefined
      const basePathPattern = deriveContentDirIndexBasePath(page.path)
      if (basePathPattern === undefined) return undefined
      const result = matchRoute(basePathPattern, path)
      if (!result.matched) return undefined
      const slugParam = deriveTrailingDynamicParamName(page.path)
      const routeParams: RouteParams =
        slugParam !== undefined ? { ...result.params, [slugParam]: indexSlug } : result.params
      return { page, basePathPattern, indexSlug, routeParams }
    })
    .find((match): match is ContentDirIndexBaseMatch => match !== undefined)
