/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Vanilla-JS runtime entrypoint for the static-site `runtime.js` script.
 *
 * Bundled with `Bun.build({ format: 'iife' })` into a single script that
 * `generateSearchIndex` writes to `<outputDir>/sovrium-search/runtime.js` —
 * prebuilt and embedded in the compiled binary, compiled on the fly in a source
 * checkout (`src/infrastructure/assets/page-search-runtime.ts`). Exposes
 * `window.SovriumSearch = { init, search }` so non-React pages can query the
 * build-time index without loading the React island bundle.
 *
 * Shares its tokenize / search logic with the React `page-search-island` via
 * the common {@link ./page-search-matcher} module, and its index fetch
 * with it through {@link ./page-search-index} — a single source of truth for the
 * client-side TF-IDF lookup contract.
 */

import { loadSearchIndex } from './page-search-index'
import { searchIndex, type SearchIndex, type SearchResult } from './page-search-matcher'

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

const init = loadSearchIndex

const search = (
  query: string,
  options?: { readonly maxResults?: number }
): Promise<ReadonlyArray<SearchResult>> =>
  init().then((index) => searchIndex(index, query, options?.maxResults ?? 10))

if (typeof window !== 'undefined') {
  ;(window as { SovriumSearch?: unknown }).SovriumSearch = { init, search }
}
