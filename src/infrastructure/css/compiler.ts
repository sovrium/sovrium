/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  getCSSCacheKey,
  getOrComputeCachedCSS,
  loadPrecompiledCSS,
  type CompiledCSS,
} from '@/infrastructure/css/cache/css-cache-service'
import {
  designCacheKey,
  EMPTY_DESIGN_CACHE_KEY,
} from '@/infrastructure/css/cache/design-cache-keys'
import {
  designSystemScopeKey,
  getDesignSystemScope,
} from '@/infrastructure/css/design-system-scope'
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
import { isCompiled, SOVRIUM_PACKAGE_ROOT } from '@/infrastructure/process/package-paths'
import { buildSourceCSS } from './source-css'
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
 * Whether the test-server pre-compiled CSS file (`SOVRIUM_CSS_FILE`) may be
 * served for this app instead of compiling per-app.
 *
 * That file is built by `compileCSSRaw()` with NO app — it holds the builtin
 * candidate set only. Reusing it is sound ONLY when:
 *  - the app declares no CSS-bearing `design` key (the file is the default CSS), AND
 *  - the app authors no class beyond the builtin set; otherwise classes the
 *    build-time scan never saw (e.g. `max-w-6xl` or arbitrary `grid-cols-[…]`
 *    from a spec/operator fixture — the scan covers `src`+`examples`, not
 * `[internal ref]`) would be silently dropped from the served CSS, breaking layout.
 *
 * `ECO_DESIGN_LAYER` is NOT consulted here: the pre-compiled file is built in
 * the default (`on`) context, so serving it under `off` would leak the override
 * surface and break the with≡without parity contract (the prestyled-islands rule,
 * contract-without-theme-layer.spec.ts) for apps that widen the candidate set.
 * Layer-off now compiles per-app like layer-on (`buildDefaultLayer` still emits
 * the `@theme` registrations under `off`, so `@apply` resolves), so the
 * candidate-set check is the only gate that matters in both layer states.
 *
 * Exported for its co-located test only. Every clause here is the difference
 * between an authored design key TAKING EFFECT and being silently inert, and
 * that is worth asserting directly rather than inferring from a compiled
 * stylesheet — reaching it through `compileCSS` needs `SOVRIUM_CSS_FILE`, a
 * sentinel file on disk, and a cache key nothing earlier in the suite has
 * already populated.
 */
export const canServePrecompiledFile = (app?: App): boolean =>
  // ONE clause covers every declared token, rather than a clause per key
  // (`app.design === undefined`, `typeScale`, `density`, `components`, …), which
  // falls behind the schema each time a key ships. The cache key already
  // enumerates every CSS-bearing key for its own reasons, so asking it whether
  // anything is declared cannot fall behind the way a hand-listed predicate does.
  designCacheKey(app?.design) === EMPTY_DESIGN_CACHE_KEY &&
  // A SCOPED design system (the `/_admin` design-system console) emits a whole
  // extra token layer that the app-agnostic pre-compiled file cannot contain.
  // Without this clause the console — which declares no design of its own and
  // may add no candidate beyond builtin — would be served that file and the
  // operator's scope would resolve NOTHING, which is precisely the
  // half-themed failure the scoped layer exists to prevent.
  getDesignSystemScope(app) === undefined &&
  !appAddsCandidatesBeyondBuiltin(app)

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
    // The named dark code-block theme's own palette, read from Shiki (async).
    const sourceCSS = buildSourceCSS(app, yield* loadCodeBlockDarkPalette(app?.design))

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
    if (isCompiled || process.env.SOVRIUM_FORCE_NATIVE_FREE_CSS === '1') {
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
/**
 * Production CSS resolution: Memory cache → File cache (only when serving the
 * generic pre-compiled file is sound) → per-app runtime compilation.
 *
 * The pre-compiled file is built with the BUILTIN candidate set only (no app
 * theme, no app-authored classes). It is a valid substitute ONLY when the app
 * neither overrides the theme nor authors any class beyond builtin (see
 * `canServePrecompiledFile`). Without this gate, an app that widens the candidate
 * set — e.g. the docs app's `dark:hidden` / `dark:block` logo lockup, or a
 * `w-[calc(100%-2.5rem)]` arbitrary value — silently has those classes dropped
 * from the served CSS (the stale-precompiled-CSS bug). The dev branches honor
 * this gate too. Inside the binary there is no native PostCSS path, so
 * `compileCSSRaw` routes to the native-free engine.
 */
const resolveProductionCSS = (
  app: App | undefined,
  cacheKey: string
): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  getOrComputeCachedCSS(
    cacheKey,
    Effect.gen(function* () {
      if (canServePrecompiledFile(app)) {
        const precompiled = yield* loadPrecompiledCSS
        if (precompiled) {
          logDebug('[CSS] Loaded from pre-compiled file')
          return precompiled
        }
        logWarning(
          '[CSS] Pre-compiled CSS not found. Falling back to runtime compilation. ' +
            'Run "sovrium build" for faster startup.'
        )
      }
      // App widens the candidate set (or overrides the theme): the generic
      // pre-compiled file would drop app-authored classes, so compile per-app.
      return yield* compileCSSRaw(app)
    })
  )

export const compileCSS = (app?: App): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    const design = app?.design
    // Key on theme AND the app's authored class candidates: the compiled output
    // depends on both, so a theme-only key serves stale CSS when classes change.
    // …and on the SCOPED design system, if the app carries one: two operators
    // with the same (absent) console theme and the same candidate set compile
    // to DIFFERENT stylesheets once their own themes are scoped into it.
    // …and on `design.density`, which emits its own `:root` + `[data-density]`
    // blocks outside the theme entirely. Two apps with the same (absent) theme
    // and the same candidate set compile to DIFFERENT stylesheets once one of
    // them declares a ladder, so without this segment the second one served is
    // handed the first one's CSS.
    //
    // …and on `design.typeScale`. The console design-cascade rule makes it
    // load-bearing — the operator's ladder cascades onto the console, so two
    // consoles with the same absent theme can differ by it. `getVersionedCssHash`'s OPERATOR branch still derives
    // its URL from `getCSSCacheKey` alone and still does not vary with a ladder:
    // a pre-existing gap on a different surface, left where it is because moving
    // it changes the stylesheet URL of every app declaring one. The CONSOLE
    // branch does cover it, through `designCascadeKey`.
    const cacheKey =
      getCSSCacheKey(design, resolveNativeFreeCandidates(app)) + designSystemScopeKey(app)

    if (isProduction) {
      return yield* resolveProductionCSS(app, cacheKey)
    }

    // See `canServePrecompiledFile` — the test-server pre-compiled file is only
    // a valid substitute when the app adds no candidates beyond builtin.
    const canUsePrecompiledFile = canServePrecompiledFile(app)

    // Dev cache bypass: recompile every request so config edits appear without a
    // restart. Still honor the pre-compiled file fast path for the default theme
    // (test servers set SOVRIUM_CSS_FILE).
    if (isDevCacheDisabled()) {
      if (canUsePrecompiledFile && process.env.SOVRIUM_CSS_FILE) {
        const precompiled = yield* loadPrecompiledCSS
        if (precompiled) {
          logDebug('[CSS] Loaded from pre-compiled file (dev, cache bypassed)')
          return precompiled
        }
      }
      return yield* compileCSSRaw(app)
    }

    // Development: Memory cache → Pre-compiled file (if no theme) → PostCSS compilation
    const result = yield* getOrComputeCachedCSS(
      cacheKey,
      Effect.gen(function* () {
        // For default theme, try loading from pre-compiled file first (e.g. test servers)
        if (canUsePrecompiledFile && process.env.SOVRIUM_CSS_FILE) {
          const precompiled = yield* loadPrecompiledCSS
          if (precompiled) {
            logDebug('[CSS] Loaded from pre-compiled file (dev mode)')
            return precompiled
          }
        }
        return yield* compileCSSRaw(app)
      })
    )

    if (Date.now() - result.timestamp > 100) {
      logDebug('[CSS] Cache hit')
    }

    return result
  })
