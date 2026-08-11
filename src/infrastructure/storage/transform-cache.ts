/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-memory LRU cache for on-the-fly image transform results.
 *
 * The first request for a given (storage key + transform params + Accept)
 * combination runs the Sharp pipeline; the produced bytes, derived
 * Content-Type, and ETag are cached so subsequent identical requests are
 * served without re-running the transform.
 *
 * The cache is a process-global module singleton — it survives across
 * requests but is scoped to a single server process. It is intentionally not
 * an Effect `Layer` resource: the download route is plain `async/await` and a
 * module singleton keeps the lookup synchronous and cheap. This mirrors the
 * in-memory rate-limiter primitive (`infrastructure/utils/sliding-window-limiter.ts`)
 * — correct for single-process deployments, which matches the E2E topology.
 *
 * **Eviction**: the total byte size of cached entries is capped by the
 * operator-controlled `STORAGE_TRANSFORM_CACHE_MAX_SIZE` env var (in
 * megabytes). When inserting an entry would exceed the cap, the
 * least-recently-used entries are evicted until it fits. A `get` promotes the
 * entry to most-recently-used.
 */

/** A cached transform result: the produced bytes plus response metadata. */
export interface CachedTransform {
  readonly bytes: Uint8Array
  readonly contentType: string
  readonly etag: string
}

/** Default cache cap (in megabytes) when the env var is unset. */
const DEFAULT_CACHE_MAX_MB = 256

/**
 * Resolve the cache size cap in bytes from `STORAGE_TRANSFORM_CACHE_MAX_SIZE`
 * (a megabyte value). Falls back to {@link DEFAULT_CACHE_MAX_MB} when the env
 * var is unset, empty, or not a positive number.
 */
const resolveMaxBytes = (): number => {
  const raw = process.env['STORAGE_TRANSFORM_CACHE_MAX_SIZE']
  const mb = raw !== undefined && raw !== '' ? Number(raw) : DEFAULT_CACHE_MAX_MB
  const effective = Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_CACHE_MAX_MB
  return effective * 1024 * 1024
}

/** The primitive API returned by {@link createTransformCache}. */
interface TransformCache {
  /** Look up a cached transform, promoting it to most-recently-used. */
  readonly get: (key: string) => CachedTransform | undefined
  /** Insert a transform result, evicting LRU entries to honour the cap. */
  readonly set: (key: string, value: CachedTransform) => void
  /**
   * Drop every cached entry whose composite key belongs to the given storage
   * key. Used when a file is deleted so stale transformed bytes are not served.
   */
  readonly evictKey: (storageKey: string) => void
}

/**
 * Construct an LRU transform cache backed by a `Map`. `Map` preserves
 * insertion order, so the first key is always the least-recently-used; a
 * `get` re-inserts the key to promote it to the tail.
 *
 * The mutable `Map` operations are encapsulated inside this factory closure,
 * matching the `createSlidingWindowLimiter` pattern — the inline ESLint
 * disables mark the deliberate stateful-cache mutations.
 */
const createTransformCache = (): TransformCache => {
  const entries = new Map<string, CachedTransform>()

  /** Drop an entry from the map, returning its byte size (0 when absent). */
  const drop = (key: string): number => {
    const entry = entries.get(key)
    if (entry === undefined) return 0
    // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data, drizzle/enforce-delete-with-where -- LRU cache requires mutable state
    entries.delete(key)
    return entry.bytes.byteLength
  }

  /**
   * Evict least-recently-used entries until `freeNeeded` bytes are available
   * under `maxBytes`. Recursive — drops one LRU entry per step.
   */
  const evictUntilFits = (freeNeeded: number, maxBytes: number): void => {
    if (currentBytes(entries) + freeNeeded <= maxBytes || entries.size === 0) return
    const lruKey = entries.keys().next().value
    if (lruKey === undefined) return
    // eslint-disable-next-line functional/no-expression-statements -- drop the LRU entry; recursion continues until the new entry fits
    drop(lruKey)
    evictUntilFits(freeNeeded, maxBytes)
  }

  return {
    get: (key) => {
      const entry = entries.get(key)
      if (entry === undefined) return undefined
      // Promote to most-recently-used: re-insert moves the key to the tail.
      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data, drizzle/enforce-delete-with-where -- LRU cache requires mutable state
      entries.delete(key)
      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- LRU cache requires mutable state
      entries.set(key, entry)
      return entry
    },
    set: (key, value) => {
      const maxBytes = resolveMaxBytes()
      const size = value.bytes.byteLength
      // Drop any prior entry for this key first so the size accounting is exact.
      // eslint-disable-next-line functional/no-expression-statements -- discard the dropped size; currentBytes recomputes the total
      drop(key)
      // An entry that cannot fit even an empty cache is never retained.
      if (size > maxBytes) return
      // Evict LRU entries until the new entry fits, then insert it.
      evictUntilFits(size, maxBytes)
      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- LRU cache requires mutable state
      entries.set(key, value)
    },
    evictKey: (storageKey) => {
      // Composite cache keys are `<storageKey>|<params>|<fmt>` (see
      // buildTransformCacheKey). An entry belongs to this storage key when it
      // equals the key exactly or starts with `<storageKey>|`.
      const prefix = `${storageKey}|`
      const stale = [...entries.keys()].filter(
        (cacheKey) => cacheKey === storageKey || cacheKey.startsWith(prefix)
      )
      // drop each stale entry from the mutable cache
      stale.forEach((cacheKey) => drop(cacheKey))
    },
  }
}

/** Sum the byte sizes of every cached entry. */
const currentBytes = (entries: ReadonlyMap<string, CachedTransform>): number =>
  [...entries.values()].reduce((total, entry) => total + entry.bytes.byteLength, 0)

/** Process-global singleton transform cache. */
const cache = createTransformCache()

/**
 * Look up a cached transform, promoting it to most-recently-used on a hit.
 * Returns `undefined` on a miss.
 */
export const getCachedTransform = (key: string): CachedTransform | undefined => cache.get(key)

/**
 * Insert a transform result into the cache, evicting least-recently-used
 * entries until the total cached size fits under the configured cap.
 */
export const setCachedTransform = (key: string, value: CachedTransform): void => {
  cache.set(key, value)
}

/**
 * Evict every cached transform derived from the given storage key.
 *
 * Each composite cache key is `<storageKey>|<params>|<fmt>`, so a single
 * storage key may back many cached transforms (one per param/format
 * combination). This drops all of them — call it whenever a file is deleted so
 * a later `GET .../files/<key>?width=…` correctly returns 404 instead of
 * serving stale cached transformed bytes.
 */
export const evictTransformCacheForKey = (storageKey: string): void => {
  cache.evictKey(storageKey)
}
