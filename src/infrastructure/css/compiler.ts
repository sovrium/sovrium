/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import tailwindcss from '@tailwindcss/postcss'
import { Console, Effect } from 'effect'
import postcss from 'postcss'
import { generateAnimationStyles } from '@/infrastructure/css/animation-styles-generator'
import {
  generateComponentsLayer,
  generateUtilitiesLayer,
} from '@/infrastructure/css/component-layer-generators'
import {
  getOrComputeCachedCSS,
  getThemeCacheKey,
  type CompiledCSS,
} from '@/infrastructure/css/css-cache-service'
import {
  generateThemeBorderRadius,
  generateThemeBreakpoints,
  generateThemeColors,
  generateThemeFonts,
  generateThemeShadows,
  generateThemeSpacing,
} from '@/infrastructure/css/theme-generators'
import { generateBaseLayer } from '@/infrastructure/css/theme-layer-generators'
import { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { Theme } from '@/domain/models/app/theme'

// Re-export CompiledCSS type for external use
export type { CompiledCSS } from '@/infrastructure/css/css-cache-service'

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

/**
 * Internal CSS compilation logic (without caching)
 * Generates and compiles Tailwind CSS from theme configuration
 */
const compileCSSInternal = (theme?: Theme): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    // Build SOURCE_CSS with theme
    const sourceCSS = buildSourceCSS(theme)

    // Diagnostic logging for CI debugging
    yield* Console.log(`CSS Compiler - Source CSS length: ${sourceCSS.length} bytes`)
    yield* Console.log(
      `CSS Compiler - Contains @import 'tailwindcss': ${sourceCSS.includes("@import 'tailwindcss'")}`
    )
    yield* Console.log(
      `CSS Compiler - Contains @import 'tw-animate-css': ${sourceCSS.includes("@import 'tw-animate-css'")}`
    )

    // Process CSS through PostCSS with Tailwind plugin
    const result = yield* Effect.tryPromise({
      try: async () => {
        // Verify PostCSS and Tailwind plugin are available
        if (!postcss || typeof postcss !== 'function') {
          // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
          return Promise.reject(new Error('PostCSS is not available'))
        }
        if (!tailwindcss || typeof tailwindcss !== 'function') {
          // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
          return Promise.reject(new Error('Tailwind CSS plugin is not available'))
        }

        const processor = postcss([tailwindcss()])
        return await processor.process(sourceCSS, {
          from: process.cwd() + '/src/styles/global.css', // Source context for import resolution
          to: undefined, // No output file (in-memory compilation)
        })
      },
      catch: (error) => {
        // Enhanced error logging for CI debugging
        logError('CSS Compilation Error Details', error)
        logDebug(`Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
        logDebug(`Error message: ${error instanceof Error ? error.message : String(error)}`)
        if (error instanceof Error && error.stack) {
          logDebug(`Error stack: ${error.stack}`)
        }
        logDebug(`Source CSS preview (first 500 chars): ${sourceCSS.slice(0, 500)}`)

        return new CSSCompilationError(error)
      },
    })

    yield* Console.log('CSS compiled and cached')

    // Create compiled CSS result
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
      yield* Console.log('CSS cache hit')
    }

    return result
  })
