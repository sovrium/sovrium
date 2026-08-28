/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir } from 'node:fs/promises'
import { Data, Effect, Ref, pipe } from 'effect'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Error class for pre-compiled CSS file operations
 */
export class PrecompiledCSSError extends Data.TaggedError('PrecompiledCSSError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Compiled CSS result with metadata
 */
export interface CompiledCSS {
  readonly css: string
  readonly timestamp: number
  readonly precompiled?: boolean
}

/**
 * Default path for pre-compiled CSS output
 */
export const DEFAULT_PRECOMPILED_CSS_PATH = '.sovrium/output.css'

/**
 * Get the pre-compiled CSS file path from env var or default
 */
export const getPrecompiledCSSPath = (): string =>
  process.env.SOVRIUM_CSS_FILE || DEFAULT_PRECOMPILED_CSS_PATH

/**
 * Load pre-compiled CSS from file if it exists
 * Returns undefined if the file doesn't exist
 */
export const loadPrecompiledCSS: Effect.Effect<CompiledCSS | undefined, never> = Effect.gen(
  function* () {
    const cssPath = getPrecompiledCSSPath()
    const file = Bun.file(cssPath)
    const exists = yield* Effect.promise(() => file.exists())
    if (!exists) return undefined
    const css = yield* Effect.promise(() => file.text())
    return { css, timestamp: Date.now(), precompiled: true }
  }
)

/**
 * Write pre-compiled CSS to file
 * Creates the parent directory if it doesn't exist
 */
export const writePrecompiledCSS = (css: string): Effect.Effect<string, PrecompiledCSSError> =>
  Effect.gen(function* () {
    const cssPath = getPrecompiledCSSPath()
    const dir = cssPath.substring(0, cssPath.lastIndexOf('/'))
    yield* Effect.tryPromise({
      try: async () => {
        // eslint-disable-next-line functional/no-expression-statements
        await mkdir(dir, { recursive: true })
        await Bun.write(cssPath, css)
      },
      catch: (cause) =>
        new PrecompiledCSSError({
          message: `Failed to write pre-compiled CSS to ${cssPath}`,
          cause,
        }),
    })
    return cssPath
  })

/**
 * In-memory cache for compiled CSS using Effect.Ref
 * Stores multiple themes keyed by normalized theme hash
 * Avoids recompiling on every request for better performance
 * Uses functional state management to avoid mutations
 */
const cssCache = Ref.makeUnsafe<Map<string, CompiledCSS>>(new Map())

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

  return Object.fromEntries(sortedKeys.map((key) => [key, sortObjectKeys(record[key])]))
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
 * Create the FULL CSS cache key from the theme AND the app-derived candidate set.
 *
 * The compiled CSS output depends on two inputs, not one: the `theme` (which
 * generates the token/component/utility layers) AND the set of Tailwind utility
 * classes authored across the app (`resolveNativeFreeCandidates(app)`), because
 * the engine only emits rules for classes it is told about. Keying on the theme
 * alone (the old `getThemeCacheKey`) serves stale CSS whenever the authored
 * classes change but the theme does not — e.g. adding `className: "text-7xl"`
 * to a page under `--watch`.
 *
 * Candidates are passed in (rather than derived here) to keep this module free
 * of a dependency on the native-free compiler and avoid an import cycle.
 *
 * @param theme - Optional theme configuration
 * @param candidates - The full candidate class list for this app
 * @returns A cache key that changes whenever theme OR the candidate set changes
 *
 * @example
 * // Same theme, different authored classes → DIFFERENT keys:
 * getCSSCacheKey(theme, ['p-4']) !== getCSSCacheKey(theme, ['p-8'])
 * // Same classes in a different order → SAME key:
 * getCSSCacheKey(theme, ['a', 'b']) === getCSSCacheKey(theme, ['b', 'a'])
 */
export const getCSSCacheKey = (theme?: Theme, candidates: readonly string[] = []): string => {
  const themeKey = getThemeCacheKey(theme)
  // Sort the candidates so the key is order-independent (they arrive unsorted from
  // a Set spread + recursive object walk), then JSON.stringify for an unambiguous
  // serialization. The `::` separator joins the two independently-stringified parts
  // so they cannot bleed into one another.
  const candidateKey = JSON.stringify(candidates.toSorted())
  return `${themeKey}::${candidateKey}`
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
// `Effect.suspend` so the empty `Map` is allocated per run rather than once at
// module load and shared by every clear.
export const clearCSSCache: Effect.Effect<void, never> = Effect.suspend(() =>
  Ref.set(cssCache, new Map())
)

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
