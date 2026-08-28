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
 * Entries are keyed by `${appRenderChecksum}:${path}:${language}:${urlLanguage}`
 * plus, for a `'content'` page, a corpus checksum (see {@link getPageCacheKey}).
 * Because the checksum changes whenever any render-affecting part of the app
 * schema changes (see `domain/services/app-render-checksum.ts`), stale entries
 * simply become unreachable after a schema edit — invalidation is automatic and
 * there is no TTL.
 *
 * The cache IS bounded, by BYTES rather than by entry count: `ECO_PAGE_CACHE_MAX_MB`
 * (default 64) caps the total HTML held. Entries are admitted until the budget
 * is reached, then insertion-order-oldest entries are evicted until the new
 * entry fits; a single entry larger than the whole budget is refused outright.
 * A byte budget is the right unit once whole docs zones are cacheable — 200
 * marketing pages and 200 long-form articles differ by an order of magnitude.
 *
 * Only `'static'` and `'content'` pages are stored here, and only for anonymous
 * requests — see `domain/services/pages/page-cacheability.ts` for the
 * cacheability rules and the safety model.
 */

import { Effect, Ref, pipe } from 'effect'
import { parseEcoPageCacheMaxMb } from '@/domain/models/env/eco/eco-page-cache-max-mb'
import {
  publishPageCacheOccupancy,
  recordPageCacheAdmission,
  type PageCacheAdmission,
} from '@/infrastructure/utils/page-cache-telemetry'

/** A cached page render plus the time it was stored (for diagnostics). */
export interface CachedPage {
  readonly html: string
  readonly timestamp: number
}

/** A stored entry — a {@link CachedPage} plus its measured UTF-8 byte size. */
interface PageCacheEntry extends CachedPage {
  readonly bytes: number
}

/**
 * Process-global page-HTML cache. `Ref` + immutable `Map` replacement keeps
 * state management functional (no mutation), matching the CSS cache.
 */
const pageCache = Ref.makeUnsafe<Map<string, PageCacheEntry>>(new Map())

/**
 * The store's two — and only two — state mutators are {@link setCachedPage}
 * and {@link clearPageCache}. Both republish occupancy to
 * `infrastructure/utils/page-cache-telemetry.ts`, which the footprint console
 * reads. A third mutator added without that call would leave the console
 * confidently reporting entries the cache no longer holds.
 */
const measureOccupancy = (
  cache: ReadonlyMap<string, PageCacheEntry>
): { readonly entries: number; readonly bytes: number } => ({
  entries: cache.size,
  bytes: [...cache.values()].reduce((total, entry) => total + entry.bytes, 0),
})

/**
 * Build the cache key for a page render.
 *
 * `urlLanguage` is a SEPARATE key dimension, not a duplicate of `language`.
 * `/fr/about` and a French-browser request to `/about` both render path
 * `/about` with `language: 'fr'`, yet only the first lets the URL prefix
 * override the page's own `meta.lang` ([internal ref]..039) — so they can
 * produce different HTML and must never share an entry.
 *
 * `corpusChecksum` is the `'content'`-page dimension: a page whose only
 * out-of-schema input is a directory of markdown files is corpus-invariant, not
 * request-invariant, so its entry is keyed by the CURRENT state of that corpus
 * as well. A markdown edit leaves the app render-checksum untouched and only
 * this segment can notice it. `'static'` pages pass `undefined` and get `-`.
 *
 * @param renderChecksum - App render-checksum (see `computeAppRenderChecksum`).
 * @param path - Request path, e.g. `/` or `/about`.
 * @param language - Detected language code, or `undefined` for the default.
 * @param variant - Optional extra key dimensions: the `/:lang/` URL-prefix
 *   locale (when the request carried one) and the content-corpus checksum
 *   (for a `'content'` page). Grouped into one object so the key builder keeps
 *   a readable call shape as dimensions accrue.
 */
export const getPageCacheKey = (
  renderChecksum: string,
  path: string,
  language: string | undefined,
  variant?: { readonly urlLanguage?: string; readonly corpusChecksum?: string }
): string =>
  `${renderChecksum}:${path}:${language ?? 'default'}:${variant?.urlLanguage ?? '-'}:${variant?.corpusChecksum ?? '-'}`

/**
 * Get a cached page by key, or `undefined` when not present.
 */
export const getCachedPage = (cacheKey: string): Effect.Effect<CachedPage | undefined, never> =>
  pipe(
    Ref.get(pageCache),
    Effect.map((cache) => cache.get(cacheKey))
  )

/** One `[key, entry]` pair of the cache map. */
type CacheItem = readonly [string, PageCacheEntry]

/**
 * The live byte budget, read from the environment per insert so an operator's
 * `ECO_PAGE_CACHE_MAX_MB` takes effect without a restart-time snapshot.
 */
const pageCacheBudgetBytes = (): number => parseEcoPageCacheMaxMb(process.env) * 1024 * 1024

/**
 * Keep the NEWEST suffix of `items` that fits in `budget`, i.e. evict
 * insertion-order-oldest entries until the total fits.
 *
 * Walks from the newest end and stops at the first entry that would overflow —
 * it does not skip an oversized entry to keep an older, smaller one, because
 * that would silently reorder eviction away from "oldest first".
 */
const keepNewestWithinBudget = (
  items: readonly CacheItem[],
  budget: number
): readonly CacheItem[] =>
  items.reduceRight<{
    readonly total: number
    readonly kept: readonly CacheItem[]
    readonly stopped: boolean
  }>(
    (acc, item) => {
      if (acc.stopped) return acc
      const total = acc.total + item[1].bytes
      if (total > budget) return { ...acc, stopped: true }
      return { total, kept: [item, ...acc.kept], stopped: false }
    },
    { total: 0, kept: [], stopped: false }
  ).kept

/**
 * What one admission did to the store, paired with the store it produced.
 *
 * `Ref.modify` needs the pair to be one named type: inferring it from two
 * returns widens `evicted` to the literal `0` of whichever branch TypeScript
 * sees first.
 */
type AdmissionOutcome = readonly [PageCacheAdmission, Map<string, PageCacheEntry>]

/** Pair an admission verdict with the store it produced, measuring occupancy once. */
const admitted = (
  verdict: { readonly evicted: number; readonly refused: number },
  // eslint-disable-next-line functional/prefer-immutable-types -- `Ref.modify` requires the mutable `Map` this pairs with; measuring it does not mutate it
  cache: Map<string, PageCacheEntry>
): AdmissionOutcome => [{ ...verdict, ...measureOccupancy(cache) }, cache]

/**
 * Store a rendered page in the cache, evicting the insertion-order-oldest
 * entries until the store is back within the `ECO_PAGE_CACHE_MAX_MB` budget.
 *
 * Re-setting an existing key replaces it in place at the NEWEST position (the
 * old entry is dropped first, so its bytes never double-count). An entry larger
 * than the entire budget is refused rather than evicting everything to make
 * room for something that still would not fit.
 */
export const setCachedPage = (cacheKey: string, page: CachedPage): Effect.Effect<void, never> =>
  pipe(
    Ref.modify(pageCache, (currentCache): AdmissionOutcome => {
      const budget = pageCacheBudgetBytes()
      const bytes = Buffer.byteLength(page.html, 'utf8')
      const others = [...currentCache].filter(([key]) => key !== cacheKey)
      if (bytes > budget) return admitted({ evicted: 0, refused: 1 }, new Map(others))
      const entry: PageCacheEntry = { html: page.html, timestamp: page.timestamp, bytes }
      const candidates = [...others, [cacheKey, entry] as const]
      const kept = keepNewestWithinBudget(candidates, budget)
      return admitted({ evicted: candidates.length - kept.length, refused: 0 }, new Map(kept))
    }),
    Effect.map(recordPageCacheAdmission)
  )

/**
 * Clear the entire page cache (used by tests and hot-reload paths).
 *
 * Republishes occupancy — but NOT as an eviction. Nothing was displaced under
 * budget pressure, and counting a hot-reload as eviction pressure would tell an
 * operator their cache is too small for its workload when it is not.
 */
// `Effect.suspend` so the empty `Map` is allocated per run rather than once at
// module load and shared by every clear.
export const clearPageCache: Effect.Effect<void, never> = Effect.suspend(() =>
  pipe(
    Ref.set(pageCache, new Map()),
    Effect.map(() => {
      publishPageCacheOccupancy({ entries: 0, bytes: 0 })
    })
  )
)

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
