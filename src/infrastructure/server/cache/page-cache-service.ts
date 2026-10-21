/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-memory cache for rendered static page HTML.
 *
 * A process-global store with plain Effect-returning accessors (no
 * `Context.Tag` / `Layer` here — the cache is a leaf storage utility with no
 * dependencies; `page-cache-live.ts` binds it to the `PageCache` port).
 *
 * Entries are keyed by `${appRenderChecksum}:${path}:${language}:${urlLanguage}`
 * plus, for a `'content'` page, a corpus checksum (see `getPageCacheKey` in `domain/models/app/pages/page-cache-key.ts`).
 * Because the checksum changes whenever any render-affecting part of the app
 * schema changes (see `domain/services/app-render-checksum.ts`), stale entries
 * simply become unreachable after a schema edit — invalidation is automatic and
 * there is no TTL.
 *
 * ### What is held, and how it is counted
 *
 * Each page is held as its UTF-8 bytes, in one exactly-sized `Uint8Array`, and
 * the budget counts those bytes. That is the whole point of the representation:
 * a JavaScript string holds two bytes per character once it carries a single
 * character outside Latin-1 (an accent, a CJK glyph, an emoji), so a store of
 * strings measured in UTF-8 could occupy close to twice its ceiling. A byte
 * array is also one flat allocation rather than a rope of string fragments, so
 * replacing pages does not leave the allocator holding several times the
 * budget.
 *
 * The cache IS bounded, by BYTES rather than by entry count: `ECO_PAGE_CACHE_MAX_MB`
 * (default 64) caps the total held. The budget bounds the cache, not the
 * process: rendering, decoding a hit and the runtime itself all sit outside it.
 *
 * ### Eviction is least recently used
 *
 * A hit moves its entry to the most recent end; an admission that would
 * overflow the budget evicts from the least recent end until the new entry
 * fits; a single entry larger than the whole budget is refused outright. With
 * insertion order instead, a crawl over more pages than the budget holds pushed
 * out every page before its second visit, the pages visitors keep returning to
 * included, and the cache served nothing.
 *
 * Only `'static'` and `'content'` pages are stored here, and only for anonymous
 * requests — see `domain/services/pages/page-cacheability.ts` for the
 * cacheability rules and the safety model.
 */

import { Effect } from 'effect'
import { parseEcoPageCacheMaxMb } from '@/domain/models/process-env/eco/eco-page-cache-max-mb'
import {
  publishPageCacheOccupancy,
  recordPageCacheAdmission,
} from '@/infrastructure/process/page-cache-telemetry'
import type { CachedPage, PageRender } from '@/application/ports/services/page-cache'

export type { CachedPage }

/**
 * The store, in recency order: the first key is the least recently used, the
 * last the most recently used. A `Map` iterates in insertion order, so moving
 * an entry to the recent end is a delete followed by a set.
 *
 * Mutable on purpose. An immutable map rebuilt on every insert copied every
 * entry per admission, and a running byte counter cannot drift from a map
 * that is only ever touched through the three functions below. Those are the
 * store's only mutators that change occupancy — {@link setCachedPage} and
 * {@link clearPageCache} — plus {@link getCachedPage}, which reorders but
 * changes neither the entries nor the bytes. The two occupancy mutators
 * republish to `infrastructure/process/page-cache-telemetry.ts`, which the
 * footprint console reads; a third added without that call would leave the
 * console confidently reporting entries the cache no longer holds.
 */
const store = new Map<string, CachedPage>()

/** The sum of `body.byteLength` over {@link store}, kept beside it. */
let heldBytes = 0

/** One encoder for the process: `TextEncoder` is stateless. */
const utf8 = new TextEncoder()

/**
 * The key builder moved to `domain/models/app/pages/page-cache-key.ts` in W5c.
 *
 * It was pure — a concatenation of values the caller already held — while
 * everything left in this module touches the store, the byte budget or the
 * occupancy telemetry. Keeping the two together meant a route could not build a
 * key without an import of `infrastructure/server/`, which the HTTP surface may
 * not have. The rationale for each key dimension travelled with it.
 */

/**
 * Get a cached page by key, or `undefined` when not present.
 *
 * A hit makes the entry the most recently used. A miss touches nothing, and
 * neither publishes telemetry: occupancy is unchanged.
 */
export const getCachedPage = (cacheKey: string): Effect.Effect<CachedPage | undefined, never> =>
  Effect.sync(() => {
    const entry = store.get(cacheKey)
    if (entry === undefined) return undefined
    store.delete(cacheKey)
    store.set(cacheKey, entry)
    return entry
  })

/**
 * The live byte budget, read from the environment per insert so an operator's
 * `ECO_PAGE_CACHE_MAX_MB` takes effect without a restart-time snapshot.
 */
const pageCacheBudgetBytes = (): number => parseEcoPageCacheMaxMb(process.env) * 1024 * 1024

/** Remove one entry, keeping the byte counter in step. */
const dropEntry = (cacheKey: string): void => {
  const entry = store.get(cacheKey)
  if (entry === undefined) return
  store.delete(cacheKey)
  heldBytes -= entry.body.byteLength
}

/**
 * Evict least-recently-used entries until at most `limit` bytes are held, and
 * return how many left.
 *
 * Walks from the least recent end and never skips an entry to keep an older,
 * smaller one, because that would reorder eviction away from "least recently
 * used first". A budget lowered at runtime is honoured here, on the next
 * admission: it evicts down to the new ceiling, however far that is.
 */
const evictUntilWithin = (limit: number): number => {
  let evicted = 0
  for (const key of store.keys()) {
    if (heldBytes <= limit) break
    dropEntry(key)
    evicted += 1
  }
  return evicted
}

/**
 * Store a rendered page in the cache, evicting the least recently used entries
 * until the store is back within the `ECO_PAGE_CACHE_MAX_MB` budget.
 *
 * Re-setting an existing key replaces it at the most recent position (the old
 * entry is dropped first, so its bytes never double-count; a re-set that is
 * refused therefore leaves no entry). An entry larger than the entire budget is
 * refused before it is encoded, rather than evicting everything to make room
 * for something that still would not fit.
 */
export const setCachedPage = (cacheKey: string, page: PageRender): Effect.Effect<void, never> =>
  Effect.sync(() => {
    const budget = pageCacheBudgetBytes()
    dropEntry(cacheKey)
    const size = Buffer.byteLength(page.html, 'utf8')
    if (size > budget) {
      recordPageCacheAdmission({ evicted: 0, refused: 1, entries: store.size, bytes: heldBytes })
      return
    }
    const evicted = evictUntilWithin(budget - size)
    store.set(cacheKey, { body: utf8.encode(page.html), timestamp: page.timestamp })
    heldBytes += size
    recordPageCacheAdmission({ evicted, refused: 0, entries: store.size, bytes: heldBytes })
  })

/**
 * Clear the entire page cache (used by tests and hot-reload paths).
 *
 * Republishes occupancy — but NOT as an eviction. Nothing was displaced under
 * budget pressure, and counting a hot-reload as eviction pressure would tell an
 * operator their cache is too small for its workload when it is not.
 */
export const clearPageCache: Effect.Effect<void, never> = Effect.sync(() => {
  store.clear()
  heldBytes = 0
  publishPageCacheOccupancy({ entries: 0, bytes: 0 })
})
