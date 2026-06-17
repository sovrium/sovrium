/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import typography from '@tailwindcss/typography'
import { Effect } from 'effect'
import { compile, type Polyfills } from 'tailwindcss'
import {
  BUILTIN_CSS_CANDIDATES,
  TAILWIND_INDEX_CSS,
  TW_ANIMATE_CSS,
} from '@/infrastructure/css/generated-css-assets'
import { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import { logDebug } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { CompiledCSS } from '@/infrastructure/css/cache/css-cache-service'

export const MINIMAL_FALLBACK_CSS = `/* Sovrium fallback styles — native-free CSS compilation failed. */
*, ::before, ::after { box-sizing: border-box; }
* { margin: 0; }
html { -webkit-text-size-adjust: 100%; line-height: 1.5; }
body { font-family: ui-sans-serif, system-ui, sans-serif; }
img, picture, video, canvas, svg { display: block; max-width: 100%; }
`

const loadStylesheet = (
  id: string
): Promise<{ readonly path: string; readonly base: string; readonly content: string }> => {
  if (id === 'tailwindcss') {
    return Promise.resolve({ path: id, base: '/', content: TAILWIND_INDEX_CSS })
  }
  if (id === 'tw-animate-css') {
    return Promise.resolve({ path: id, base: '/', content: TW_ANIMATE_CSS })
  }
  return Promise.reject(
    new Error(
      `Native-free CSS compiler cannot resolve @import '${id}'. ` +
        'Only tailwindcss and tw-animate-css are embedded in the binary.'
    )
  )
}

const loadModule = (
  id: string
): Promise<{ readonly path: string; readonly base: string; readonly module: unknown }> => {
  if (id === '@tailwindcss/typography') {
    return Promise.resolve({ path: id, base: '/', module: typography })
  }
  return Promise.reject(
    new Error(
      `Native-free CSS compiler cannot resolve @plugin '${id}'. ` +
        'Only @tailwindcss/typography is embedded in the binary.'
    )
  )
}

export const extractClassTokens = (raw: string): readonly string[] =>
  raw
    .split(/\s+/)
    .filter((token) => token.length > 0 && !token.includes('$'))

const collectClassStrings = (node: unknown): readonly string[] => {
  if (Array.isArray(node)) {
    return node.flatMap(collectClassStrings)
  }
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) =>
      (key === 'className' || key === 'class') && typeof value === 'string'
        ? extractClassTokens(value)
        : collectClassStrings(value)
    )
  }
  return []
}

export const resolveNativeFreeCandidates = (app?: App): readonly string[] => [
  ...new Set([...BUILTIN_CSS_CANDIDATES, ...collectClassStrings(app)]),
]

export const appAddsCandidatesBeyondBuiltin = (app?: App): boolean => {
  const builtin = new Set<string>(BUILTIN_CSS_CANDIDATES)
  return collectClassStrings(app).some((token) => !builtin.has(token))
}

export const compileCSSNativeFree = (
  sourceCSS: string,
  app?: App
): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.tryPromise({
    try: async () => {
      const candidates = resolveNativeFreeCandidates(app)
      logDebug(`[CSS] Native-free compile — ${candidates.length} candidates`)
      const compiled = await compile(sourceCSS, {
        base: '/',
        polyfills: 3 as Polyfills,
        loadStylesheet,
        loadModule: loadModule as NonNullable<Parameters<typeof compile>[1]>['loadModule'],
      })
      const css = compiled.build([...candidates])
      logDebug(`[CSS] Native-free compile produced ${css.length} bytes`)
      return { css, timestamp: Date.now() }
    },
    catch: (error) => new CSSCompilationError(error),
  })
