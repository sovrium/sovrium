/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Ref } from 'effect'
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
 * Stores multiple themes keyed by theme hash
 * Avoids recompiling on every request for better performance
 * Uses functional state management to avoid mutations
 */
const cssCache = Ref.unsafeMake<Map<string, CompiledCSS>>(new Map())

/**
 * Create theme cache key from app theme
 * Returns consistent hash for same theme content
 *
 * @param theme - Optional theme configuration
 * @returns Cache key string (JSON stringified theme)
 *
 * @example
 * getThemeCacheKey(theme) // => '{"colors":{"primary":"#ff5733"}}'
 * getThemeCacheKey(undefined) // => '{}'
 */
export function getThemeCacheKey(theme?: Theme): string {
  return JSON.stringify(theme || {})
}

/**
 * Get cached CSS if available
 *
 * @param cacheKey - Cache key for the theme
 * @returns Effect that yields cached CSS or undefined
 */
export const getCachedCSS = (cacheKey: string): Effect.Effect<CompiledCSS | undefined, never> =>
  Effect.gen(function* () {
    const cache = yield* Ref.get(cssCache)
    return cache.get(cacheKey)
  })

/**
 * Store compiled CSS in cache
 *
 * @param cacheKey - Cache key for the theme
 * @param compiled - Compiled CSS result
 * @returns Effect that updates the cache
 */
export const setCachedCSS = (cacheKey: string, compiled: CompiledCSS): Effect.Effect<void, never> =>
  Ref.update(cssCache, (currentCache) => new Map([...currentCache, [cacheKey, compiled]]))
