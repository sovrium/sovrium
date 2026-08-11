/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Vanilla-JS runtime entrypoint for the static-site `runtime.js` script.
 *
 * Bundled by `generateSearchIndex` via `Bun.build({ format: 'iife' })` into a
 * single script written to `<outputDir>/sovrium-search/runtime.js`. Exposes
 * `window.SovriumSearch = { init, search }` so non-React pages can query the
 * build-time index without loading the React island bundle.
 *
 * Shares its tokenize / search logic with the React `page-search-island` via
 * the common {@link ./matcher} module — a single source of truth for the
 * client-side TF-IDF lookup contract.
 */

import { searchIndex, type SearchIndex, type SearchResult } from './matcher'

declare global {
  // `var` is required by TypeScript inside `declare global` for module
  // augmentation of `window`. ESLint's `no-var` rule is off in this position.
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
        // eslint-disable-next-line functional/no-throw-statements
        throw new Error(`Failed to load search index: ${r.status}`)
      }
      return r.json() as Promise<SearchIndex>
    })
    .then((data) => {
      // eslint-disable-next-line functional/immutable-data
      state.cached = data
      // eslint-disable-next-line functional/immutable-data
      state.pending = undefined
      return data
    })
    .catch((err) => {
      // eslint-disable-next-line functional/immutable-data
      state.pending = undefined
      // eslint-disable-next-line functional/no-throw-statements
      throw err
    })
  // eslint-disable-next-line functional/immutable-data
  state.pending = p
  return p
}

const search = (
  query: string,
  options?: { readonly maxResults?: number }
): Promise<ReadonlyArray<SearchResult>> =>
  init().then((index) => searchIndex(index, query, options?.maxResults ?? 10))

if (typeof window !== 'undefined') {
  // eslint-disable-next-line functional/immutable-data
  ;(window as { SovriumSearch?: unknown }).SovriumSearch = { init, search }
}
