/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface CachedTransform {
  readonly bytes: Uint8Array
  readonly contentType: string
  readonly etag: string
}

const DEFAULT_CACHE_MAX_MB = 256

const resolveMaxBytes = (): number => {
  const raw = process.env['STORAGE_TRANSFORM_CACHE_MAX_SIZE']
  const mb = raw !== undefined && raw !== '' ? Number(raw) : DEFAULT_CACHE_MAX_MB
  const effective = Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_CACHE_MAX_MB
  return effective * 1024 * 1024
}

interface TransformCache {
  readonly get: (key: string) => CachedTransform | undefined
  readonly set: (key: string, value: CachedTransform) => void
  readonly evictKey: (storageKey: string) => void
}

const createTransformCache = (): TransformCache => {
  const entries = new Map<string, CachedTransform>()

  const drop = (key: string): number => {
    const entry = entries.get(key)
    if (entry === undefined) return 0
    entries.delete(key)
    return entry.bytes.byteLength
  }

  const evictUntilFits = (freeNeeded: number, maxBytes: number): void => {
    if (currentBytes(entries) + freeNeeded <= maxBytes || entries.size === 0) return
    const lruKey = entries.keys().next().value
    if (lruKey === undefined) return
    drop(lruKey)
    evictUntilFits(freeNeeded, maxBytes)
  }

  return {
    get: (key) => {
      const entry = entries.get(key)
      if (entry === undefined) return undefined
      entries.delete(key)
      entries.set(key, entry)
      return entry
    },
    set: (key, value) => {
      const maxBytes = resolveMaxBytes()
      const size = value.bytes.byteLength
      drop(key)
      if (size > maxBytes) return
      evictUntilFits(size, maxBytes)
      entries.set(key, value)
    },
    evictKey: (storageKey) => {
      const prefix = `${storageKey}|`
      const stale = [...entries.keys()].filter(
        (cacheKey) => cacheKey === storageKey || cacheKey.startsWith(prefix)
      )
      stale.forEach((cacheKey) => drop(cacheKey))
    },
  }
}

const currentBytes = (entries: ReadonlyMap<string, CachedTransform>): number =>
  [...entries.values()].reduce((total, entry) => total + entry.bytes.byteLength, 0)

const cache = createTransformCache()

export const getCachedTransform = (key: string): CachedTransform | undefined => cache.get(key)

export const setCachedTransform = (key: string, value: CachedTransform): void => {
  cache.set(key, value)
}

export const evictTransformCacheForKey = (storageKey: string): void => {
  cache.evictKey(storageKey)
}
