/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isPublicPage } from './is-public'
import type { Page } from './page'

/**
 * `getPublicPagePaths` — pure Domain helper returning the paths of pages that
 * are eligible for anonymous static emission and indexing.
 *
 * A page is "publicly emittable" when:
 * 1. Its `path` does NOT start with `_` (admin/internal pages are excluded
 *    from sitemaps, static HTML, and the search index by convention), AND
 * 2. `isPublicPage(page)` returns true (the page is anonymously readable —
 *    `access` is missing / `'all'` / `{ require: 'all' }`).
 *
 * This is the single source of truth for the "static emission + search index"
 * page set. It is NOT the sitemap filter, and never was: `isPageInSitemap`
 * (`sitemap-builder.ts`) is an independent predicate that shares the
 * `isPublicPage` and `/_`-prefix conditions but adds `meta.noindex`,
 * `meta.robots: noindex` and `sitemap: false` — an indexing concern this set
 * has no opinion on. Reading that as "this set plus one check" is what let the
 * sitemap ship for months without consulting `access` at all; the
 * two filters agree on the access question by calling the SAME `isPublicPage`,
 * not by one being derived from the other.
 *
 * ## Why a helper, not 3 inline copies
 *
 * The filter was duplicated across:
 * - `application/use-cases/server/static-language-generators.ts` (multi-lang)
 * - `application/use-cases/server/static-language-generators.ts` (single-lang)
 * - `index.ts::build` (search-indexer `publicPagePaths`)
 *
 * Three sites that must stay in lock-step — change any one independently and
 * the search index drifts from the emitted HTML (re-introducing the
 * [internal ref] access-leak regression). Centralizing here
 * encodes the invariant once.
 *
 * @param pages - The `app.pages` array (typically `validatedApp.pages`).
 * @returns Page paths in original schema order. Empty when `pages` is nullish.
 */
export const getPublicPagePaths = (pages: readonly Page[] | undefined): readonly string[] =>
  (pages ?? [])
    .filter((page) => !page.path.startsWith('/_') && isPublicPage(page))
    .map((page) => page.path)
