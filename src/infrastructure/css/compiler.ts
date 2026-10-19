/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { withCompileDiskCache } from '@/infrastructure/css/cache/compile-disk-cache'
import {
  getOrComputeCachedCSS,
  loadPrecompiledCSS,
  warnStalePrecompiledOnce,
  type CompiledCSS,
} from '@/infrastructure/css/cache/css-cache-service'
import {
  designCacheKey,
  EMPTY_DESIGN_CACHE_KEY,
} from '@/infrastructure/css/cache/design-cache-keys'
import { getDesignSystemScope } from '@/infrastructure/css/design-system-scope'
import {
  appAddsCandidatesBeyondBuiltin,
  compileCSSNativeFree,
  MINIMAL_FALLBACK_CSS,
  resolveNativeFreeCandidates,
} from '@/infrastructure/css/native-free-compiler'
import { loadCodeBlockDarkPalette } from '@/infrastructure/css/theme/code-block-theme-palette'
import { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import { logDebug, logError, logWarning } from '@/infrastructure/logging/logger'
import { isDevCacheDisabled, isProduction as checkIsProduction } from '@/infrastructure/process/env'
import { SOVRIUM_PACKAGE_ROOT } from '@/infrastructure/process/package-paths'
import { compileCacheTarget } from './compile-cache-target'
import { buildSourceCSS } from './source-css'
import { cssCompileKey, precompiledStampOf, usesNativeFreeCompiler } from './versioned-css-path'
import type { App } from '@/domain/models/app'
import type { AcceptedPlugin, Result as PostcssResult } from 'postcss'

// Re-export CompiledCSS type for external use
export type { CompiledCSS } from '@/infrastructure/css/cache/css-cache-service'

const CSS_COMPILATION_TIMEOUT_MS = 30_000

/**
 * Create a timeout promise that rejects after the configured timeout.
 * Prevents silent hangs when native binaries are missing.
 */
const createCompilationTimeout = (): Promise<never> =>
  new Promise<never>((_resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `CSS compilation timed out after ${CSS_COMPILATION_TIMEOUT_MS / 1000}s. ` +
              'This usually means native binaries for @tailwindcss/oxide or lightningcss ' +
              'are missing for this platform. ' +
              'Fix: run "bun add @tailwindcss/oxide lightningcss" to install platform-specific binaries.'
          )
        ),
      CSS_COMPILATION_TIMEOUT_MS
    )
    // Don't keep the event loop alive just for this safety-net timer.
    // Without unref(), a successful build subprocess hangs for 30s waiting for this timer.
    timer.unref()
  })

/**
 * Process CSS source through PostCSS with the Tailwind plugin.
 * Races compilation against a timeout to catch missing native binaries.
 *
 * `postcss` and `@tailwindcss/postcss` are imported lazily on purpose: that
 * chain loads native `.node` addons (lightningcss, @tailwindcss/oxide) which a
 * `bun build --compile` standalone binary cannot resolve from its virtual
 * filesystem. A static top-level import would crash the binary at module-load
 * time — before the `isCompiled` branch in `compileCSSRaw` ever runs. Deferring
 * the import to this function, which is only ever reached on the from-source
 * path, keeps the native chain out of the binary's load graph (issue #19).
 */
const processWithPostCSS = async (sourceCSS: string): Promise<PostcssResult> => {
  const { default: postcss } = await import('postcss')
  const { default: tailwindcss } = await import('@tailwindcss/postcss')

  // Cast needed: @tailwindcss/postcss bundles its own PostCSS types
  // which are structurally identical but nominally different from top-level postcss
  const processor = postcss([tailwindcss() as AcceptedPlugin])
  // The `from` path anchors PostCSS's `@import` resolver. Earlier this used
  // `process.cwd() + '/src/styles/global.css'`, which works when the CLI is
  // invoked from the Sovrium source tree (where `tailwindcss` lives in
  // `node_modules`) but FAILS when invoked from a partner application's
  // working directory (no `tailwindcss` installed). The fix: anchor the
  // `from` path at the SOVRIUM package root, so the `@import 'tailwindcss'`
  // resolves against Sovrium's own `node_modules` regardless of the operator's
  // CWD. The synthetic `src/styles/global.css` segment is kept so any error
  // messages remain stable and recognisable.
  const compilationPromise = processor.process(sourceCSS, {
    from: SOVRIUM_PACKAGE_ROOT + '/src/styles/global.css',
    to: undefined,
  })

  return Promise.race([compilationPromise, createCompilationTimeout()])
}

/**
 * Make the source CSS self-contained so the native PostCSS pipeline never scans
 * the filesystem for utility candidates.
 *
 * `@tailwindcss/postcss` auto-detects content by walking the project tree from
 * the `from` path. That scan is both unbounded (it reaches `vendor/` and any
 * large file under `src/`) and anchored to a synthetic `from`
 * (`src/styles/global.css` does not exist), so it OOMs `markUsedVariable`. We
 * disable it with `source(none)` and supply the exact candidate set via
 * `@source inline(...)` — the SAME `BUILTIN_CSS_CANDIDATES ∪ app className`
 * union the native-free binary path uses (`resolveNativeFreeCandidates`). Both
 * compile paths are now deterministic and scan-free.
 */
const makeScanlessSource = (sourceCSS: string, app?: App): string => {
  const candidates = resolveNativeFreeCandidates(app)
  return sourceCSS.replace(
    "@import 'tailwindcss';",
    `@import 'tailwindcss' source(none);\n    @source inline("${candidates.join(' ')}");`
  )
}

/**
 * Log a CSS compilation failure. The caught error is passed as the `cause` arg
 * so its stack is printed locally AND forwarded to Sentry (no manual splitting
 * of type/message/stack across separate debug lines).
 */
const logCompilationError = (error: unknown): CSSCompilationError => {
  logError('[css] compilation failed', error)
  return new CSSCompilationError(error)
}

const isProduction = checkIsProduction()

/**
 * Compile `app`'s stylesheet, or reuse the bytes an earlier process compiled
 * for the same engine and inputs. The minimal fallback served after a failed
 * native-free compile is never stored: it must not outlive the failure.
 */
const compileOrReuse = (app?: App): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  withCompileDiskCache(
    compileCacheTarget(app),
    compileCSSRaw(app),
    (compiled) => compiled.css !== MINIMAL_FALLBACK_CSS
  )

/**
 * Whether the GENERIC pre-compiled file — built by `compileCSSRaw()` with NO
 * app, holding the builtin candidate set under the default design, as the test
 * harness writes it once per run — is a sound substitute for this app's own
 * compile. {@link acceptsPrecompiledStamp} asks this only of a file carrying
 * the generic stamp; a file stamped with the app's OWN hash needs no shape
 * test, the stamp already says the bytes are its.
 *
 * The generic compile IS this app's compile only when:
 *  - the app declares no CSS-bearing `design` key — ONE clause through the
 *    cache key, which enumerates every CSS-bearing key for its own reasons and
 *    so cannot fall behind the schema the way a hand-listed predicate does; AND
 *  - it carries no scoped design system: the `/_admin` console emits a whole
 *    extra token layer the app-agnostic file cannot contain, and served that
 *    file the operator's scope would resolve NOTHING — the half-themed failure
 *    the scoped layer exists to prevent; AND
 *  - it authors no class beyond the builtin set; otherwise classes the
 *    build-time scan never saw (`max-w-6xl`, an arbitrary `grid-cols-[…]` from
 *    a spec fixture) would be silently dropped from the served CSS.
 *
 * `ECO_DESIGN_LAYER` is NOT consulted: the file is built in the default (`on`)
 * context and layer-off compiles per-app like layer-on (`buildDefaultLayer`
 * still emits the `@theme` registrations under `off`), so the candidate-set
 * check is the only gate that matters in both layer states.
 *
 * Exported for its co-located test: every clause is the difference between an
 * authored design key TAKING EFFECT and being silently inert.
 */
export const canServePrecompiledFile = (app?: App): boolean =>
  designCacheKey(app?.design) === EMPTY_DESIGN_CACHE_KEY &&
  getDesignSystemScope(app) === undefined &&
  !appAddsCandidatesBeyondBuiltin(app)

/**
 * Whether a pre-compiled file carrying `stamp` as its first line was built by
 * THIS engine for THIS app, and may be served in place of a compile.
 *
 * Two stamps are accepted: the app's own ({@link precompiledStampOf}), which
 * `sovrium build` writes; and the generic, app-free one, which the test
 * harness writes once for every zero-config server — sound only where
 * {@link canServePrecompiledFile} already says the generic compile IS this
 * app's compile. No stamp (every file written before stamps existed) and any
 * other hash mean another engine or another design: the file is stale.
 *
 * Exported for its co-located test: each clause is the difference between an
 * upgrade serving last release's tokens and compiling the right ones.
 *
 * @param stamp - The hash the file's first line records, if it has one.
 * @param app - The app about to be served.
 */
export const acceptsPrecompiledStamp = (stamp: string | undefined, app?: App): boolean =>
  stamp !== undefined &&
  (stamp === precompiledStampOf(app) ||
    (stamp === precompiledStampOf() && canServePrecompiledFile(app)))

/**
 * Internal CSS compilation logic (without caching)
 * Generates and compiles Tailwind CSS from theme configuration
 *
 * Accepts the full `App` so the compiled-binary path can also collect the
 * utility classes authored in the operator's `className` props.
 *
 * Inside a `bun build --compile` standalone binary the native PostCSS pipeline
 * is unavailable; this function transparently uses the pure-JS native-free
 * compiler there instead (issue #19). From-source / npm-bundled runs are
 * unchanged.
 */
export const compileCSSRaw = (app?: App): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    // The dark code-block theme's own palette, read from Shiki (async).
    const sourceCSS = buildSourceCSS(app, yield* loadCodeBlockDarkPalette)

    logDebug(`[CSS] Source CSS length: ${sourceCSS.length} bytes`)
    logDebug(`[CSS] Contains @import 'tailwindcss': ${sourceCSS.includes("@import 'tailwindcss'")}`)
    logDebug(`[CSS] Contains tw-animate-css: ${sourceCSS.includes("@import 'tw-animate-css'")}`)

    // Inside a `bun build --compile` standalone binary, the native PostCSS /
    // Tailwind / lightningcss pipeline cannot load its `.node` addons from the
    // virtual filesystem (issue #19). Compile with the pure-JS native-free
    // engine instead. If that path itself fails (unexpected), serve minimal
    // fallback styles with an actionable log line rather than crashing.
    //
    // SOVRIUM_FORCE_NATIVE_FREE_CSS=1 forces this path from source too, so the
    // native-free output can be verified without compiling a binary.
    if (usesNativeFreeCompiler()) {
      return yield* compileCSSNativeFree(sourceCSS, app).pipe(
        Effect.catch((error) => {
          logError(
            '[CSS] Native-free compilation failed inside the compiled binary. ' +
              'This is a Sovrium bug — please report it at ' +
              'https://github.com/sovrium/sovrium/issues. Serving minimal fallback styles.',
            error
          )
          return Effect.succeed({ css: MINIMAL_FALLBACK_CSS, timestamp: Date.now() })
        })
      )
    }

    const result = yield* Effect.tryPromise({
      try: () => processWithPostCSS(makeScanlessSource(sourceCSS, app)),
      catch: (error) => logCompilationError(error),
    })

    logDebug('[CSS] Compiled and cached')

    return {
      css: result.css,
      timestamp: Date.now(),
    }
  })

/**
 * The pre-compiled file, or a compile: the one resolution every mode shares.
 *
 * The file is served only when its stamp says it IS the file this engine would
 * write for this app ({@link acceptsPrecompiledStamp}). An upgrade that kept
 * serving the previous release's stylesheet, old tokens included, until someone
 * deleted the file is what the stamp exists to end (issue #200); and before the
 * stamp carried that answer the app's SHAPE stood in for it, so a designed app
 * was compiled around the very file `sovrium build` had just written for it.
 *
 * A file that is not this app's is one of two things. Stamped with another
 * engine's or another design's hash, it is STALE: set aside with ONE warning
 * per process, compiled around, and left on disk untouched — the operator asked
 * for that file, and rewriting it behind their back is how the next surprise
 * gets built. Carrying the generic stamp where the generic compile is not sound
 * for this app, it was built for no config in particular and is simply not a
 * fast path here: compiled around, silently — nothing is stale, and a designed
 * app booting beside the harness's shared file has nothing to be told.
 *
 * "Compiled" here means {@link compileOrReuse}: a restart with unchanged
 * inputs reads back the previous process's compile from the on-disk cache
 * instead of running Tailwind again.
 *
 * @param app - The app being served.
 * @param mayUsePrecompiledFile - Whether this mode reads the file at all.
 */
const precompiledOrCompile = (
  app: App | undefined,
  mayUsePrecompiledFile: boolean
): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    if (!mayUsePrecompiledFile) return yield* compileOrReuse(app)
    const file = yield* loadPrecompiledCSS
    if (file === undefined) {
      if (isProduction) {
        logWarning(
          '[CSS] Pre-compiled CSS not found. Falling back to runtime compilation. ' +
            'Run "sovrium build" for faster startup.'
        )
      }
      return yield* compileOrReuse(app)
    }
    if (acceptsPrecompiledStamp(file.stamp, app)) {
      logDebug('[CSS] Loaded from pre-compiled file')
      return { css: file.css, timestamp: Date.now(), precompiled: true }
    }
    if (file.stamp === precompiledStampOf()) return yield* compileOrReuse(app)
    yield* warnStalePrecompiledOnce(file.path)
    const compiled = yield* compileOrReuse(app)
    return { ...compiled, staleIgnored: true }
  })

/**
 * Compiles Tailwind CSS using PostCSS with @tailwindcss/postcss plugin
 *
 * This function:
 * 1. Extracts theme from app config (if provided)
 * 2. Generates dynamic SOURCE_CSS with @theme tokens
 * 3. Processes through PostCSS with Tailwind CSS v4 plugin
 * 4. Returns the compiled CSS string
 * 5. Caches the result in memory per theme (subsequent requests use cache)
 *
 * Uses getOrComputeCachedCSS for declarative caching with normalized theme keys.
 * Same theme content always produces the same cache key regardless of property order.
 *
 * @param app - Optional app configuration containing theme
 * @returns Effect that yields compiled CSS string or CSSCompilationError
 *
 * @example
 * ```typescript
 * // Without theme (minimal CSS)
 * const program = Effect.gen(function* () {
 *   const result = yield* compileCSS()
 *   console.log(`Compiled ${result.css.length} bytes of CSS`)
 * })
 *
 * // With app theme
 * const programWithTheme = Effect.gen(function* () {
 *   const result = yield* compileCSS(app)
 *   console.log(`Compiled ${result.css.length} bytes of CSS with theme`)
 * })
 *
 * Effect.runPromise(program)
 * ```
 */
export const compileCSS = (app?: App): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    // Every input the compiled bytes depend on — the design (density and type
    // ladder included, each of which emits outside the theme), the app's
    // candidate set, and the scoped design system a console surface carries —
    // in the ONE expression the pre-compiled stamp is also derived from
    // (`cssCompileKey`), so the file is accepted exactly where the cache would
    // have hit. `getVersionedCssHash`'s OPERATOR branch still does not vary
    // with `design.typeScale`: a pre-existing gap on a different surface, left
    // where it is because moving it changes the stylesheet URL of every app
    // declaring one. The CONSOLE branch covers it through `designCascadeKey`.
    const cacheKey = cssCompileKey(app)

    // Production reads `output.css` in the data directory (or SOVRIUM_CSS_FILE);
    // development reads the file only when SOVRIUM_CSS_FILE names one (test
    // servers do). A console surface never reads it: the file is the OPERATOR
    // app's, and the console's compile — scoped token layer and all — can never
    // match it, so reading it could only raise a false stale warning. The gate
    // on what the file holds is `precompiledOrCompile`'s.
    const mayUsePrecompiledFile =
      getDesignSystemScope(app) === undefined &&
      (isProduction || Boolean(process.env.SOVRIUM_CSS_FILE))

    // `SOVRIUM_DEV_NO_CACHE=1` bypass: recompile every request so an edit shows
    // without a restart. Still honor the pre-compiled file fast path for the
    // default theme.
    if (!isProduction && isDevCacheDisabled()) {
      return yield* precompiledOrCompile(app, mayUsePrecompiledFile)
    }

    // Memory cache → pre-compiled file (when sound) → compilation
    const result = yield* getOrComputeCachedCSS(
      cacheKey,
      precompiledOrCompile(app, mayUsePrecompiledFile)
    )

    if (!isProduction && Date.now() - result.timestamp > 100) {
      logDebug('[CSS] Cache hit')
    }

    return result
  })
