/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Data, Effect, Ref, pipe } from 'effect'
import { defaultPrecompiledCssPath } from '@/domain/models/process-env/data-dir'
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
  /**
   * A pre-compiled file was found but set aside as stale (built by another
   * engine or for another design), and this stylesheet was compiled instead.
   * Travels with the cache entry so the startup report can say so even when
   * the compile happened before the report ran.
   */
  readonly staleIgnored?: boolean
  /**
   * Served from the on-disk compile cache: the bytes an earlier process
   * compiled for the same engine and the same inputs.
   */
  readonly reused?: boolean
}

/**
 * Where the pre-compiled stylesheet lives, for `build` (write) and `start`
 * (read) alike: `SOVRIUM_CSS_FILE` when set, else `output.css` in the data
 * directory — beside the database, so `SOVRIUM_DATA_DIR` moves both. The one
 * seam both verbs resolve the path through, so they cannot disagree.
 */
export const getPrecompiledCSSPath = (): string =>
  process.env.SOVRIUM_CSS_FILE || defaultPrecompiledCssPath()

/** What `/*! sovrium-css <hash> *\/`, the first line of a pre-compiled file, opens with. */
const PRECOMPILED_STAMP_PREFIX = '/*! sovrium-css '

/**
 * The stamp line in full, with its hash captured. Anchored to the start of the
 * file: a stamp anywhere else is just a comment.
 */
const PRECOMPILED_STAMP_LINE = /^\/\*! sovrium-css (\S+) \*\/(?:\r?\n|$)/

/**
 * Prepend the stamp line to a compiled stylesheet. Idempotent: a stylesheet
 * that already opens with a stamp (a production `build` reading back the file
 * it wrote last time) has that line REPLACED, never doubled.
 *
 * @param css - The compiled stylesheet.
 * @param stamp - The hash recording which engine and design compiled it.
 */
export const stampPrecompiledCSS = (css: string, stamp: string): string =>
  `${PRECOMPILED_STAMP_PREFIX}${stamp} */\n${css.replace(PRECOMPILED_STAMP_LINE, '')}`

/**
 * The hash a pre-compiled file's first line records, or `undefined` when the
 * file opens with anything else — every file written before stamps existed.
 */
export const readPrecompiledStamp = (css: string): string | undefined =>
  PRECOMPILED_STAMP_LINE.exec(css)?.[1]

/** A pre-compiled file as found on disk: its whole text, its stamp, its path. */
export interface PrecompiledCSSFile {
  readonly css: string
  readonly stamp: string | undefined
  readonly path: string
}

/**
 * Load the pre-compiled stylesheet if the file exists.
 *
 * Answers `undefined` when there is no file (or it cannot be read). Whether the
 * file is CURRENT is the caller's question (`acceptsPrecompiledStamp` in the
 * compiler): this module cannot compute the stamp without importing the
 * candidate resolver it deliberately stays clear of (see `getCSSCacheKey`).
 */
export const loadPrecompiledCSS: Effect.Effect<PrecompiledCSSFile | undefined, never> = Effect.gen(
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
      try: async (): Promise<PrecompiledCSSFile> => {
        const css = await file.text()
        return { css, stamp: readPrecompiledStamp(css), path: cssPath }
      },
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
 * Write the pre-compiled stylesheet, stamp line first.
 * Creates the parent directory if it doesn't exist.
 *
 * @param css - The compiled stylesheet.
 * @param stamp - The hash a later `start` compares against its own.
 */
export const writePrecompiledCSS = (
  css: string,
  stamp: string
): Effect.Effect<string, PrecompiledCSSError> =>
  Effect.gen(function* () {
    const cssPath = getPrecompiledCSSPath()
    // `dirname`, not a slash search: the default path is built with `path.join`,
    // which separates with backslashes on Windows, and `SOVRIUM_CSS_FILE` may be
    // a bare file name. Either gave a slash search an empty directory to create,
    // and the build then reported it could not write the stylesheet.
    const dir = dirname(cssPath)
    yield* Effect.tryPromise({
      try: async () => {
        await mkdir(dir, { recursive: true })
        await Bun.write(cssPath, stampPrecompiledCSS(css, stamp))
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
 * Whether the stale-file warning has been printed by this process. One line
 * per boot is the contract: the file is re-read on every request under the
 * development cache bypass and once per cache key otherwise, and the operator
 * needs telling once, not once per page.
 */
const staleWarningPrinted = Ref.makeUnsafe(false)

/**
 * Warn, once per process, that the pre-compiled file at `path` was set aside.
 * Not a swallowed failure: nothing failed, the file is simply not this
 * engine's, and the caller compiles the stylesheet it would have served.
 *
 * @param path - The file that was ignored, so the operator knows which to rebuild.
 */
export const warnStalePrecompiledOnce = (path: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    const alreadyPrinted = yield* Ref.getAndSet(staleWarningPrinted, true)
    if (alreadyPrinted) return
    logWarning(
      `[CSS] Pre-compiled stylesheet at ${path} was built by a different engine or config; ` +
        'compiling afresh. Re-run `sovrium build`.'
    )
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
