/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import type { SearchResult } from './matcher'

/**
 * The session index: `GET /api/search/pages?q=` answers with the pages the
 * current reader may open (`index: 'session'` on the `search-input`). Asked per
 * debounced keystroke rather than loaded once, because the answer depends on who
 * is signed in — which is also why nothing here is cached across queries.
 *
 * A failed request answers with no results: an empty panel is the honest state
 * of a search that could not run. Every hit's `url` becomes an `href` and a
 * `location` target, so a hit that is not a same-origin path is dropped rather
 * than trusted — the server only ever answers page paths, and this keeps it so.
 */
interface SessionHit {
  readonly url: string
  readonly title: string
  readonly excerpt?: string
}

export const querySessionIndex = async (
  query: string,
  maxResults: number
): Promise<ReadonlyArray<SearchResult>> => {
  try {
    const response = await fetch(`/api/search/pages?q=${encodeURIComponent(query)}`, {
      credentials: 'same-origin',
    })
    if (!response.ok) return []
    const hits = (await response.json()) as ReadonlyArray<SessionHit>
    return hits.slice(0, maxResults).flatMap((hit): ReadonlyArray<SearchResult> => {
      const url = toSafeRedirectPath(hit.url)
      return url === undefined
        ? []
        : [{ url, title: hit.title, excerpt: hit.excerpt ?? '', score: 0 }]
    })
  } catch (error: unknown) {
    console.warn('[page-search] session query failed:', error)
    return []
  }
}
