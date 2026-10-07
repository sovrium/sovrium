/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The client runtime's entry: a loader that imports only the features the
 * page asked for.
 *
 * Served at `/assets/client.js` (and under its content-hashed name in a
 * prebuilt release). The page's tag names its features in
 * `data-sovrium-runtime` (`<script type="module" src="…" data-sovrium-runtime="core">`),
 * and each feature is a separate chunk the split build writes to
 * `/assets/client-chunks/`, imported here by a relative specifier so the
 * chunks resolve beside whichever name the entry was served under.
 *
 * A module script has no `document.currentScript`, so the tag is found by its
 * attribute. A document holding NO such tag still gets `core`: that is a
 * document cached from a release whose tag carried no feature list, or one
 * whose entry was added by a content-only navigation, and in both the entry was
 * only ever loaded to run `core`.
 *
 * Each feature is imported at most once per document, and a chunk is a module
 * that evaluates once however many entries import it, so loading the entry
 * twice (its stable and its hashed name) still initializes each feature once.
 *
 * The page declares each feature's chunks as `modulepreload` in `<head>`, so
 * the `import()` below normally finds them already fetched. Without that, a
 * feature would initialize a round trip after `load`, which is when
 * `page.goto()` returns.
 */

import { reloadOnceForStaleChunk } from './runtime/stale-chunk-reload'

/** The features a page can ask for, each behind its own split point. */
const FEATURE_LOADERS: Readonly<Record<string, () => Promise<unknown>>> = {
  core: () => import('./runtime/client-core-runtime'),
}

/** The feature list of the page's runtime tag, `core` when there is none. */
function requestedFeatures(): readonly string[] {
  const declared = document
    .querySelector<HTMLScriptElement>('script[data-sovrium-runtime]')
    ?.dataset.sovriumRuntime?.split(/\s+/)
    .filter((feature) => feature !== '')
  return declared ?? ['core']
}

/**
 * Import each requested feature. An unknown name is skipped: a document cached
 * from a newer release may name a feature this entry does not know.
 *
 * A failed import of a chunk a newer release replaced reloads the page once
 * (see `stale-chunk-reload.ts`), as the island entry does.
 */
function loadFeatures(features: readonly string[]): void {
  new Set(features).forEach((feature) => {
    void FEATURE_LOADERS[feature]?.().catch((error: unknown) => {
      if (!reloadOnceForStaleChunk(error)) {
        // A non-stale failure surfaces as an unhandled rejection, as it did before the split.
        throw error
      }
    })
  })
}

loadFeatures(requestedFeatures())
