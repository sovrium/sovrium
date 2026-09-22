/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir } from 'node:fs/promises'
import { Data, Effect, Ref, pipe } from 'effect'
import { designCacheKey } from '@/infrastructure/css/cache/design-cache-keys'
import { logWarning } from '@/infrastructure/logging/logger'
import type { Design } from '@/domain/models/app/design'

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
    // effect-promise: total -- `BunFile.exists()` answers a missing or unreadable path with `false`; it reports absence as its RESULT, which is the whole question being asked here.
    const exists = yield* Effect.promise(() => file.exists())
    if (!exists) return undefined
    // The READ can still fail — permissions, or the file being replaced between
    // the check and the read. The declared `never` made that a defect on the
    // CSS route, which then answered 500 rather than falling back to compiling
    // the stylesheet, which is exactly what `undefined` here asks the caller to
    // do.
    return yield* Effect.tryPromise({
      try: async () => ({ css: await file.text(), timestamp: Date.now(), precompiled: true }),
      catch: (cause) => new PrecompiledCSSError({ message: `Could not read ${cssPath}`, cause }),
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logWarning(`[css] pre-compiled stylesheet unreadable, recompiling: ${String(cause)}`)
        })
      ),
      // effect-swallow: see the tap above. `undefined` is this function's
      // documented "there is no pre-compiled CSS" answer, and an unreadable
      // file means exactly that as far as the caller is concerned.
      Effect.orElseSucceed(() => undefined)
    )
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
 * Stores multiple compiled stylesheets keyed by the design + candidate hash
 * Avoids recompiling on every request for better performance
 * Uses functional state management to avoid mutations
 */
const cssCache = Ref.makeUnsafe<Map<string, CompiledCSS>>(new Map())

/**
 * Create the FULL CSS cache key from the DESIGN and the app-derived candidate set.
 *
 * The compiled CSS output depends on two inputs, not one: the design (which
 * generates the token/component/utility layers) AND the set of Tailwind utility
 * classes authored across the app (`resolveNativeFreeCandidates(app)`), because
 * the engine only emits rules for classes it is told about. Keying on the design
 * alone serves stale CSS whenever the authored classes change but the tokens do
 * not — e.g. adding `className: "text-7xl"` to a page under `--watch`.
 *
 * The design half goes through {@link designCacheKey}, which keys on every
 * CSS-BEARING key and omits the rest. That distinction only became necessary
 * with the flattening: while the tokens lived inside one container this hashed
 * that container wholesale, so no key could be missed. Now each key stands on
 * its own and an omitted one serves one app's stylesheet to another.
 *
 * Candidates are passed in (rather than derived here) to keep this module free
 * of a dependency on the native-free compiler and avoid an import cycle.
 *
 * @param design - Optional design configuration
 * @param candidates - The full candidate class list for this app
 * @returns A cache key that changes whenever the design OR the candidate set changes
 *
 * @example
 * // Same design, different authored classes → DIFFERENT keys:
 * getCSSCacheKey(design, ['p-4']) !== getCSSCacheKey(design, ['p-8'])
 * // Same classes in a different order → SAME key:
 * getCSSCacheKey(design, ['a', 'b']) === getCSSCacheKey(design, ['b', 'a'])
 */
export const getCSSCacheKey = (design?: Design, candidates: readonly string[] = []): string => {
  const designKey = designCacheKey(design)
  // Sort the candidates so the key is order-independent (they arrive unsorted from
  // a Set spread + recursive object walk), then JSON.stringify for an unambiguous
  // serialization. The `::` separator joins the two independently-stringified parts
  // so they cannot bleed into one another.
  const candidateKey = JSON.stringify(candidates.toSorted())
  return `${designKey}::${candidateKey}`
}

/**
 * Get cached CSS if available
 *
 * @param cacheKey - Cache key for the compiled stylesheet
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
 * @param cacheKey - Cache key for the compiled stylesheet
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
 * @param cacheKey - Cache key for the compiled stylesheet
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
