/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Ref, pipe } from 'effect'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Compiled CSS result with metadata
 */
export interface CompiledCSS {
  readonly css: string
  readonly timestamp: number
}

/**
 * In-memory cache for compiled CSS using Effect.Ref
 * Stores multiple themes keyed by normalized theme hash
 * Avoids recompiling on every request for better performance
 * Uses functional state management to avoid mutations
 */
const cssCache = Ref.unsafeMake<Map<string, CompiledCSS>>(new Map())

/**
 * Recursively sort object keys for consistent JSON serialization
 * This ensures the same theme always produces the same cache key
 * regardless of property insertion order
 */
const sortObjectKeys = (obj: unknown): unknown => {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }

  const record = obj as Record<string, unknown>
  const sortedKeys = Object.keys(record).toSorted()

  return sortedKeys.reduce<Record<string, unknown>>(
    (acc, key) => ({ ...acc, [key]: sortObjectKeys(record[key]) }),
    {}
  )
}

/**
 * Normalize theme for consistent cache key generation
 * Sorts object keys recursively to ensure property order independence
 *
 * @param theme - Optional theme configuration
 * @returns Normalized theme (or undefined if no theme)
 */
export const normalizeTheme = (theme?: Theme): Theme | undefined => {
  if (!theme) return undefined
  return sortObjectKeys(theme) as Theme
}

/**
 * Create theme cache key from app theme
 * Returns consistent hash for same theme content regardless of property order
 *
 * @param theme - Optional theme configuration
 * @returns Cache key string (JSON stringified normalized theme)
 *
 * @example
 * // These produce the same cache key:
 * getThemeCacheKey({ colors: { primary: '#ff5733' }, fonts: { sans: 'Inter' } })
 * getThemeCacheKey({ fonts: { sans: 'Inter' }, colors: { primary: '#ff5733' } })
 */
export const getThemeCacheKey = (theme?: Theme): string => {
  const normalized = normalizeTheme(theme)
  return JSON.stringify(normalized ?? {})
}

/**
 * Get cached CSS if available
 *
 * @param cacheKey - Cache key for the theme
 * @returns Effect that yields cached CSS or undefined
 */
export const getCachedCSS = (cacheKey: string): Effect.Effect<CompiledCSS | undefined, never> =>
  pipe(
    Ref.get(cssCache),
    Effect.map((cache) => cache.get(cacheKey))
  )

/**
 * Store compiled CSS in cache
 *
 * @param cacheKey - Cache key for the theme
 * @param compiled - Compiled CSS result
 * @returns Effect that updates the cache
 */
export const setCachedCSS = (cacheKey: string, compiled: CompiledCSS): Effect.Effect<void, never> =>
  Ref.update(cssCache, (currentCache) => new Map([...currentCache, [cacheKey, compiled]]))

/**
 * Clear all cached CSS (useful for testing or hot reload)
 *
 * @returns Effect that clears the cache
 */
export const clearCSSCache = (): Effect.Effect<void, never> => Ref.set(cssCache, new Map())

/**
 * Get or compute cached CSS
 * This is a convenience function that combines getCachedCSS and setCachedCSS
 * with a computation function for cleaner usage
 *
 * @param cacheKey - Cache key for the theme
 * @param compute - Effect that computes the CSS if not cached
 * @returns Effect that yields cached or newly computed CSS
 */
export const getOrComputeCachedCSS = <E>(
  cacheKey: string,
  compute: Effect.Effect<CompiledCSS, E>
): Effect.Effect<CompiledCSS, E> =>
  Effect.gen(function* () {
    const cached = yield* getCachedCSS(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const compiled = yield* compute
    yield* setCachedCSS(cacheKey, compiled)
    return compiled
  })
