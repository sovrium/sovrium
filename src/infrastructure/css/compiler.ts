/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import tailwindcss from '@tailwindcss/postcss'
import { Effect } from 'effect'
import postcss from 'postcss'
import {
  getOrComputeCachedCSS,
  getThemeCacheKey,
  type CompiledCSS,
} from '@/infrastructure/css/cache/css-cache-service'
import { generateAnimationStyles } from '@/infrastructure/css/styles/animation-styles-generator'
import {
  generateComponentsLayer,
  generateUtilitiesLayer,
} from '@/infrastructure/css/styles/component-layer-generators'
import {
  generateThemeBorderRadius,
  generateThemeBreakpoints,
  generateThemeColors,
  generateThemeFonts,
  generateThemeShadows,
  generateThemeSpacing,
} from '@/infrastructure/css/theme/theme-generators'
import { generateBaseLayer } from '@/infrastructure/css/theme/theme-layer-generators'
import { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { Theme } from '@/domain/models/app/theme'

// Re-export CompiledCSS type for external use
export type { CompiledCSS } from '@/infrastructure/css/cache/css-cache-service'

/**
 * Generate complete Tailwind @theme CSS from app theme
 */
function generateThemeCSS(theme?: Theme): string {
  if (!theme) return ''

  const themeTokens = [
    generateThemeColors(theme.colors),
    generateThemeFonts(theme.fonts),
    generateThemeSpacing(theme.spacing),
    generateThemeShadows(theme.shadows),
    generateThemeBorderRadius(theme.borderRadius),
    generateThemeBreakpoints(theme.breakpoints),
  ].filter(Boolean)

  if (themeTokens.length === 0) return ''

  return `@theme {\n${themeTokens.join('\n')}\n  }`
}

/**
 * Static CSS imports and custom variants
 */
const STATIC_IMPORTS = `@import 'tailwindcss';
    @import 'tw-animate-css';
    /*---break---
     */
    @custom-variant dark (&:is(.dark *));`

/**
 * Final base layer for global resets
 * Note: Removed hardcoded utilities (border-border, bg-background, etc.)
 * These should be defined in the app theme if needed
 */
const FINAL_BASE_LAYER = ''

/**
 * Build dynamic SOURCE_CSS with theme tokens
 * Generates Tailwind CSS with @theme directive based on app theme
 */
function buildSourceCSS(theme?: Theme): string {
  const themeCSS = generateThemeCSS(theme)
  const animationCSS = generateAnimationStyles(theme?.animations, theme)
  const baseLayerCSS = generateBaseLayer(theme)
  const componentsLayerCSS = generateComponentsLayer(theme)
  const utilitiesLayerCSS = generateUtilitiesLayer()

  return [
    STATIC_IMPORTS,
    baseLayerCSS,
    componentsLayerCSS,
    utilitiesLayerCSS,
    '/*---break---\n     */',
    themeCSS,
    '/*---break---\n     */',
    animationCSS,
    '/*---break---\n     */',
    FINAL_BASE_LAYER,
  ]
    .filter(Boolean)
    .join('\n\n    ')
}

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
    // eslint-disable-next-line functional/no-expression-statements
    timer.unref()
  })

/**
 * Process CSS source through PostCSS with Tailwind plugin.
 * Races compilation against a timeout to catch missing native binaries.
 */
const processWithPostCSS = (sourceCSS: string): Promise<postcss.Result> => {
  if (!postcss || typeof postcss !== 'function') {
    return Promise.reject(new Error('PostCSS is not available'))
  }
  if (!tailwindcss || typeof tailwindcss !== 'function') {
    return Promise.reject(new Error('Tailwind CSS plugin is not available'))
  }

  // Cast needed: @tailwindcss/postcss bundles its own PostCSS types
  // which are structurally identical but nominally different from top-level postcss
  const processor = postcss([tailwindcss() as postcss.AcceptedPlugin])
  const compilationPromise = processor.process(sourceCSS, {
    from: process.cwd() + '/src/styles/global.css',
    to: undefined,
  })

  return Promise.race([compilationPromise, createCompilationTimeout()])
}

/**
 * Log detailed error diagnostics for CSS compilation failures (CI debugging)
 */
const logCompilationError = (error: unknown, sourceCSS: string): CSSCompilationError => {
  logError('CSS Compilation Error Details', error)
  logDebug(`Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
  logDebug(`Error message: ${error instanceof Error ? error.message : String(error)}`)
  if (error instanceof Error && error.stack) {
    logDebug(`Error stack: ${error.stack}`)
  }
  logDebug(`Source CSS preview (first 500 chars): ${sourceCSS.slice(0, 500)}`)
  return new CSSCompilationError(error)
}

/**
 * Internal CSS compilation logic (without caching)
 * Generates and compiles Tailwind CSS from theme configuration
 */
const compileCSSInternal = (theme?: Theme): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    const sourceCSS = buildSourceCSS(theme)

    logDebug(`[CSS] Source CSS length: ${sourceCSS.length} bytes`)
    logDebug(`[CSS] Contains @import 'tailwindcss': ${sourceCSS.includes("@import 'tailwindcss'")}`)
    logDebug(
      `[CSS] Contains @import 'tw-animate-css': ${sourceCSS.includes("@import 'tw-animate-css'")}`
    )

    const result = yield* Effect.tryPromise({
      try: () => processWithPostCSS(sourceCSS),
      catch: (error) => logCompilationError(error, sourceCSS),
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
export const compileCSS = (app?: App): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    const theme = app?.theme
    const cacheKey = getThemeCacheKey(theme)

    // Use declarative cache helper with theme-based key
    const result = yield* getOrComputeCachedCSS(cacheKey, compileCSSInternal(theme))

    // Log cache status (hit if timestamp is old, compiled if fresh)
    if (Date.now() - result.timestamp > 100) {
      logDebug('[CSS] Cache hit')
    }

    return result
  })
