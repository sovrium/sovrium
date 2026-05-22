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
  compileCSSNativeFree,
  MINIMAL_FALLBACK_CSS,
  resolveNativeFreeCandidates,
} from '@/infrastructure/css/native-free-compiler'
import { generateAnimationStyles } from '@/infrastructure/css/styles/animation-styles-generator'
import {
  generateComponentsLayer,
  generateUtilitiesLayer,
} from '@/infrastructure/css/styles/component-layer-generators'
import { generateCodeBlockStyles } from '@/infrastructure/css/theme/code-block-styles-generator'
import {
  NEUTRAL_FLOOR_LAYER,
  V1_ALIAS_BRIDGE,
  V1_TOKEN_LAYER,
} from '@/infrastructure/css/theme/default-theme-layer'
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
import { logDebug, logError, logWarning } from '@/infrastructure/logging/logger'
import { isDevCacheDisabled, isProduction as checkIsProduction } from '@/infrastructure/utils/env'
import { isCompiled } from '@/infrastructure/utils/package-paths'
import type { App } from '@/domain/models/app'
import type { Theme } from '@/domain/models/app/theme'
import type { AcceptedPlugin, Result as PostcssResult } from 'postcss'

export type { CompiledCSS } from '@/infrastructure/css/cache/css-cache-service'

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

  return `@theme static {\n${themeTokens.join('\n')}\n  }`
}

const STATIC_IMPORTS = `@import 'tailwindcss';
    @import 'tw-animate-css';
    /*---break---
     */
    @custom-variant dark (&:is(.dark *));
    /* @theme static (not plain @theme) so the full red palette is ALWAYS
       emitted to :root by BOTH compile engines. The pure-JS native-free engine
       (binary path) keeps every declared token, while real oxide tree-shakes a
       plain @theme block down to only candidate-referenced tokens — making the
       binary CSS emit reds the dev CSS dropped (CLI-BINARY-CSS-006). static
       opts both engines out of tree-shaking so they stay equivalent. */
    @theme static {
      --color-red-50: #fef2f2;
      --color-red-100: #fee2e2;
      --color-red-200: #fecaca;
      --color-red-300: #fca5a5;
      --color-red-400: #f87171;
      --color-red-500: #ef4444;
      --color-red-600: #dc2626;
      --color-red-700: #b91c1c;
      --color-red-800: #991b1b;
      --color-red-900: #7f1d1d;
      --color-red-950: #450a0a;
    }`

const FINAL_BASE_LAYER = ''

function buildDefaultLayer(theme?: Theme): string {
  const tokenLayer = theme?.baseline === 'replace' ? NEUTRAL_FLOOR_LAYER : V1_TOKEN_LAYER
  return `${tokenLayer}\n\n  ${V1_ALIAS_BRIDGE}`
}

function buildSourceCSS(theme?: Theme): string {
  const themeCSS = generateThemeCSS(theme)
  const animationCSS = generateAnimationStyles(theme?.animations, theme)
  const defaultLayerCSS = buildDefaultLayer(theme)
  const baseLayerCSS = generateBaseLayer(theme)
  const componentsLayerCSS = generateComponentsLayer(theme)
  const utilitiesLayerCSS = generateUtilitiesLayer()
  const codeBlockCSS = generateCodeBlockStyles(theme)

  return [
    STATIC_IMPORTS,
    defaultLayerCSS,
    baseLayerCSS,
    componentsLayerCSS,
    utilitiesLayerCSS,
    '/*---break---\n     */',
    themeCSS,
    '/*---break---\n     */',
    animationCSS,
    '/*---break---\n     */',
    codeBlockCSS,
    '/*---break---\n     */',
    FINAL_BASE_LAYER,
  ]
    .filter(Boolean)
    .join('\n\n    ')
}

const CSS_COMPILATION_TIMEOUT_MS = 30_000

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
    timer.unref()
  })

const processWithPostCSS = async (sourceCSS: string): Promise<PostcssResult> => {
  const { default: postcss } = await import('postcss')
  const { default: tailwindcss } = await import('@tailwindcss/postcss')

  const processor = postcss([tailwindcss() as AcceptedPlugin])
  const compilationPromise = processor.process(sourceCSS, {
    from: process.cwd() + '/src/styles/global.css',
    to: undefined,
  })

  return Promise.race([compilationPromise, createCompilationTimeout()])
}

const makeScanlessSource = (sourceCSS: string, app?: App): string => {
  const candidates = resolveNativeFreeCandidates(app)
  return sourceCSS.replace(
    "@import 'tailwindcss';",
    `@import 'tailwindcss' source(none);\n    @source inline("${candidates.join(' ')}");`
  )
}

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

const isProduction = checkIsProduction()

export const compileCSSRaw = (app?: App): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    const theme = app?.theme
    const sourceCSS = buildSourceCSS(theme)

    logDebug(`[CSS] Source CSS length: ${sourceCSS.length} bytes`)
    logDebug(`[CSS] Contains @import 'tailwindcss': ${sourceCSS.includes("@import 'tailwindcss'")}`)
    logDebug(
      `[CSS] Contains @import 'tw-animate-css': ${sourceCSS.includes("@import 'tw-animate-css'")}`
    )

    if (isCompiled || process.env.SOVRIUM_FORCE_NATIVE_FREE_CSS === '1') {
      return yield* compileCSSNativeFree(sourceCSS, app).pipe(
        Effect.catchAll((error) => {
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
      catch: (error) => logCompilationError(error, sourceCSS),
    })

    logDebug('[CSS] Compiled and cached')

    return {
      css: result.css,
      timestamp: Date.now(),
    }
  })

export const compileCSS = (app?: App): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    const theme = app?.theme
    const cacheKey = getCSSCacheKey(theme, resolveNativeFreeCandidates(app))

    if (isProduction) {
      const result = yield* getOrComputeCachedCSS(
        cacheKey,
        Effect.gen(function* () {
          const precompiled = yield* loadPrecompiledCSS()
          if (precompiled) {
            logDebug('[CSS] Loaded from pre-compiled file')
            return precompiled
          }
          logWarning(
            '[CSS] Pre-compiled CSS not found. Falling back to runtime compilation. ' +
              'Run "sovrium build" for faster startup.'
          )
          return yield* compileCSSRaw(app)
        })
      )
      return result
    }

    if (isDevCacheDisabled()) {
      if (!theme && process.env.SOVRIUM_CSS_FILE) {
        const precompiled = yield* loadPrecompiledCSS()
        if (precompiled) {
          logDebug('[CSS] Loaded from pre-compiled file (dev, cache bypassed)')
          return precompiled
        }
      }
      return yield* compileCSSRaw(app)
    }

    const result = yield* getOrComputeCachedCSS(
      cacheKey,
      Effect.gen(function* () {
        if (!theme && process.env.SOVRIUM_CSS_FILE) {
          const precompiled = yield* loadPrecompiledCSS()
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
