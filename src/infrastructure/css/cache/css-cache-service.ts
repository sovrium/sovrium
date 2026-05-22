/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir } from 'node:fs/promises'
import { Data, Effect, Ref, pipe } from 'effect'
import type { Theme } from '@/domain/models/app/theme'

export class PrecompiledCSSError extends Data.TaggedError('PrecompiledCSSError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export interface CompiledCSS {
  readonly css: string
  readonly timestamp: number
  readonly precompiled?: boolean
}

export const DEFAULT_PRECOMPILED_CSS_PATH = '.sovrium/output.css'

export const getPrecompiledCSSPath = (): string =>
  process.env.SOVRIUM_CSS_FILE || DEFAULT_PRECOMPILED_CSS_PATH

export const loadPrecompiledCSS = (): Effect.Effect<CompiledCSS | undefined, never> =>
  Effect.gen(function* () {
    const cssPath = getPrecompiledCSSPath()
    const file = Bun.file(cssPath)
    const exists = yield* Effect.promise(() => file.exists())
    if (!exists) return undefined
    const css = yield* Effect.promise(() => file.text())
    return { css, timestamp: Date.now(), precompiled: true }
  })

export const writePrecompiledCSS = (css: string): Effect.Effect<string, PrecompiledCSSError> =>
  Effect.gen(function* () {
    const cssPath = getPrecompiledCSSPath()
    const dir = cssPath.substring(0, cssPath.lastIndexOf('/'))
    yield* Effect.tryPromise({
      try: async () => {
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

const cssCache = Ref.unsafeMake<Map<string, CompiledCSS>>(new Map())

const sortObjectKeys = (obj: unknown): unknown => {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }

  const record = obj as Record<string, unknown>
  const sortedKeys = Object.keys(record).toSorted()

  return sortedKeys.reduce<Record<string, unknown>>(
    (acc, key) => ({ ...acc, [key]: sortObjectKeys(record[key]) }),
    {}
  )
}

export const normalizeTheme = (theme?: Theme): Theme | undefined => {
  if (!theme) return undefined
  return sortObjectKeys(theme) as Theme
}

export const getThemeCacheKey = (theme?: Theme): string => {
  const normalized = normalizeTheme(theme)
  return JSON.stringify(normalized ?? {})
}

export const getCSSCacheKey = (theme?: Theme, candidates: readonly string[] = []): string => {
  const themeKey = getThemeCacheKey(theme)
  const candidateKey = JSON.stringify(candidates.toSorted())
  return `${themeKey}::${candidateKey}`
}

export const getCachedCSS = (cacheKey: string): Effect.Effect<CompiledCSS | undefined, never> =>
  pipe(
    Ref.get(cssCache),
    Effect.map((cache) => cache.get(cacheKey))
  )

export const setCachedCSS = (cacheKey: string, compiled: CompiledCSS): Effect.Effect<void, never> =>
  Ref.update(cssCache, (currentCache) => new Map([...currentCache, [cacheKey, compiled]]))

export const clearCSSCache = (): Effect.Effect<void, never> => Ref.set(cssCache, new Map())

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
