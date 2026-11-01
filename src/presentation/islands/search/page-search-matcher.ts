/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared client-side search matcher for the public-pages search feature.
 *
 * This module is the single source of truth for query tokenization and ranked
 * lookup against the build-time TF-IDF index emitted by `generateSearchIndex`.
 * It is consumed by:
 *
 *   1. The React `page-search-island` (statically imported, bundled into the
 *      island chunks by `Bun.build` splitting).
 *   2. The vanilla-JS `runtime.js` IIFE (compiled to JS by `Bun.build` at
 *      search-index generation time, wrapped in an IIFE that exposes
 *      `window.SovriumSearch = { init, search }`).
 *
 * ## Tokenization contract
 *
 * Query tokens come from the same `tokenizeForSearch`
 * (`@/domain/kernel/matching/search-tokens`) the indexer runs over page bodies
 * and titles, so the `tokens[]` lookup table aligns by construction.
 *
 * ## Security note (consumed by every page-search render path)
 *
 * Returned `result.title` and `result.excerpt` are **plain text** strings
 * (HTML-entity decoded by the indexer before storage). Consumers MUST render
 * them via React text-child interpolation or `.textContent`, NEVER via
 * `.innerHTML` / `dangerouslySetInnerHTML`. The CLAUDE.md S2 rule applies.
 */

import { tokenizeForSearch } from '@/domain/kernel/matching/search-tokens'

export interface SearchIndexPage {
  readonly url: string
  readonly title: string
  readonly excerptText: string
}

export interface SearchIndexPosting {
  readonly url: string
  readonly score: number
}

export interface SearchIndex {
  readonly pages: ReadonlyArray<SearchIndexPage>
  readonly tokens: Readonly<Record<string, ReadonlyArray<SearchIndexPosting>>>
}

export interface SearchResult {
  readonly url: string
  readonly title: string
  readonly excerpt: string
  readonly score: number
}

const DEFAULT_MAX_RESULTS = 10

/**
 * Score every page that matches any query token by summing the per-posting
 * scores recorded at build time, then return the top N pages sorted by score
 * descending. URL → page lookup happens once via a precomputed map.
 */
export const searchIndex = (
  index: SearchIndex,
  query: string,
  maxResults: number = DEFAULT_MAX_RESULTS
): ReadonlyArray<SearchResult> => {
  if (!index || !index.tokens || !index.pages) return []
  const queryTokens = tokenizeForSearch(query)
  if (queryTokens.length === 0) return []

  // Sum scores per URL across all matching query tokens. We accumulate into a
  // plain record (no `Map` mutation, no `for-of` — both fall foul of the
  // functional-immutable lint rules) via `reduce`.
  const scoresByUrl = queryTokens.reduce<Record<string, number>>((acc, token) => {
    const postings = index.tokens[token]
    if (!postings) return acc
    return postings.reduce<Record<string, number>>(
      (inner, posting) => ({
        ...inner,
        [posting.url]: (inner[posting.url] ?? 0) + posting.score,
      }),
      acc
    )
  }, {})

  const pagesByUrl: Readonly<Record<string, SearchIndexPage>> = index.pages.reduce<
    Record<string, SearchIndexPage>
  >((acc, page) => ({ ...acc, [page.url]: page }), {})

  const results: ReadonlyArray<SearchResult> = Object.entries(scoresByUrl)
    .map<SearchResult | undefined>(([url, score]) => {
      const page = pagesByUrl[url]
      if (!page) return undefined
      return {
        url,
        title: page.title || '',
        excerpt: page.excerptText || '',
        score,
      }
    })
    .filter((r): r is SearchResult => r !== undefined)

  // Sort desc by score. We can't call `.sort()` (Sovrium's no-restricted-syntax
  // forbids it), so insertion-sort via reduce. N is bounded by the page count
  // of the site, in practice tiny.
  const sorted = results.reduce<ReadonlyArray<SearchResult>>((sortedAcc, item) => {
    const insertAt = sortedAcc.findIndex((existing) => existing.score < item.score)
    return insertAt === -1
      ? [...sortedAcc, item]
      : [...sortedAcc.slice(0, insertAt), item, ...sortedAcc.slice(insertAt)]
  }, [])

  return sorted.slice(0, maxResults)
}
