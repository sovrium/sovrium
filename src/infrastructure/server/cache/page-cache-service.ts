/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-memory cache for rendered static page HTML.
 *
 * Mirrors `infrastructure/css/cache/css-cache-service.ts`: a process-global
 * `Ref<Map>` singleton with plain Effect-returning accessors (no `Context.Tag`
 * / `Layer` — the cache is a leaf storage utility with no dependencies).
 *
 * Entries are keyed by `${appRenderChecksum}:${path}:${language}`. Because the
 * checksum changes whenever any render-affecting part of the app schema
 * changes (see `domain/services/app-render-checksum.ts`), stale entries simply
 * become unreachable after a schema edit — invalidation is automatic, there is
 * no TTL and no purge logic.
 *
 * Only request-invariant ("static") pages are stored here, and only for
 * anonymous requests — see `domain/services/page-cacheability.ts` for the
 * cacheability rules and the safety model.
 */

import { Effect, Ref, pipe } from 'effect'

/** A cached page render plus the time it was stored (for diagnostics). */
export interface CachedPage {
  readonly html: string
  readonly timestamp: number
}

/**
 * Process-global page-HTML cache. `Ref` + immutable `Map` replacement keeps
 * state management functional (no mutation), matching the CSS cache.
 */
const pageCache = Ref.unsafeMake<Map<string, CachedPage>>(new Map())

/**
 * Build the cache key for a page render.
 *
 * `urlLanguage` is a SEPARATE key dimension, not a duplicate of `language`.
 * `/fr/about` and a French-browser request to `/about` both render path
 * `/about` with `language: 'fr'`, yet only the first lets the URL prefix
 * override the page's own `meta.lang` ([internal ref]..039) — so they can
 * produce different HTML and must never share an entry.
 *
 * @param renderChecksum - App render-checksum (see `computeAppRenderChecksum`).
 * @param path - Request path, e.g. `/` or `/about`.
 * @param language - Detected language code, or `undefined` for the default.
 * @param urlLanguage - The `/:lang/` URL-prefix locale, when the request had one.
 */
export const getPageCacheKey = (
  renderChecksum: string,
  path: string,
  language: string | undefined,
  urlLanguage?: string
): string => `${renderChecksum}:${path}:${language ?? 'default'}:${urlLanguage ?? '-'}`

/**
 * Get a cached page by key, or `undefined` when not present.
 */
export const getCachedPage = (cacheKey: string): Effect.Effect<CachedPage | undefined, never> =>
  pipe(
    Ref.get(pageCache),
    Effect.map((cache) => cache.get(cacheKey))
  )

/**
 * Store a rendered page in the cache.
 */
export const setCachedPage = (cacheKey: string, page: CachedPage): Effect.Effect<void, never> =>
  Ref.update(pageCache, (currentCache) => new Map([...currentCache, [cacheKey, page]]))

/**
 * Clear the entire page cache (used by tests and hot-reload paths).
 */
export const clearPageCache = (): Effect.Effect<void, never> => Ref.set(pageCache, new Map())

/**
 * Get a cached page or compute, store, and return it on a miss.
 *
 * @param cacheKey - Key produced by {@link getPageCacheKey}.
 * @param compute - Effect that renders the page HTML when not cached.
 * @returns The HTML and whether it was a cache `hit` or `miss`.
 */
export const getOrComputeCachedPage = <E>(
  cacheKey: string,
  compute: Effect.Effect<string, E>
): Effect.Effect<{ readonly html: string; readonly cacheStatus: 'hit' | 'miss' }, E> =>
  Effect.gen(function* () {
    const cached = yield* getCachedPage(cacheKey)
    if (cached !== undefined) {
      return { html: cached.html, cacheStatus: 'hit' as const }
    }

    const html = yield* compute
    yield* setCachedPage(cacheKey, { html, timestamp: Date.now() })
    return { html, cacheStatus: 'miss' as const }
  })
