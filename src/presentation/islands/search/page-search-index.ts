/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { SearchIndex } from './page-search-matcher'

/**
 * The build-time page-search index, fetched once per page and shared by every
 * reader of it — the React page-search island and the vanilla `runtime.js`
 * (`window.SovriumSearch`) alike. Concurrent callers share the request in
 * flight; a failed request is forgotten, so the next caller asks again, and
 * rejects for its caller to decide what an unavailable index means.
 */

let cached: SearchIndex | undefined = undefined
let pending: Promise<SearchIndex> | undefined = undefined

export const loadSearchIndex = (): Promise<SearchIndex> => {
  if (cached) return Promise.resolve(cached)
  if (pending) return pending
  const request = fetch('/sovrium-search/index.json', { credentials: 'same-origin' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Failed to load search index: ${response.status}`)
      return (await response.json()) as SearchIndex
    })
    .then((index) => {
      cached = index
      pending = undefined
      return index
    })
    .catch((error: unknown) => {
      pending = undefined
      throw error
    })
  pending = request
  return request
}
