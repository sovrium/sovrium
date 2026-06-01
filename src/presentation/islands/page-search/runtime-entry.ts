/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { searchIndex, type SearchIndex, type SearchResult } from './matcher'

declare global {
  var SovriumSearch:
    | {
        readonly init: () => Promise<SearchIndex>
        readonly search: (
          query: string,
          options?: { readonly maxResults?: number }
        ) => Promise<ReadonlyArray<SearchResult>>
      }
    | undefined
}

interface IndexState {
  cached: SearchIndex | undefined
  pending: Promise<SearchIndex> | undefined
}

const state: IndexState = { cached: undefined, pending: undefined }

const init = (): Promise<SearchIndex> => {
  if (state.cached) return Promise.resolve(state.cached)
  if (state.pending) return state.pending
  const p = fetch('/sovrium-search/index.json', { credentials: 'same-origin' })
    .then((r) => {
      if (!r.ok) {
        throw new Error(`Failed to load search index: ${r.status}`)
      }
      return r.json() as Promise<SearchIndex>
    })
    .then((data) => {
      state.cached = data
      state.pending = undefined
      return data
    })
    .catch((err) => {
      state.pending = undefined
      throw err
    })
  state.pending = p
  return p
}

const search = (
  query: string,
  options?: { readonly maxResults?: number }
): Promise<ReadonlyArray<SearchResult>> =>
  init().then((index) => searchIndex(index, query, options?.maxResults ?? 10))

if (typeof window !== 'undefined') {
  ;(window as { SovriumSearch?: unknown }).SovriumSearch = { init, search }
}
