/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Ref, pipe } from 'effect'

export interface CachedPage {
  readonly html: string
  readonly timestamp: number
}

const pageCache = Ref.unsafeMake<Map<string, CachedPage>>(new Map())

export const getPageCacheKey = (
  renderChecksum: string,
  path: string,
  language: string | undefined
): string => `${renderChecksum}:${path}:${language ?? 'default'}`

export const getCachedPage = (cacheKey: string): Effect.Effect<CachedPage | undefined, never> =>
  pipe(
    Ref.get(pageCache),
    Effect.map((cache) => cache.get(cacheKey))
  )

export const setCachedPage = (cacheKey: string, page: CachedPage): Effect.Effect<void, never> =>
  Ref.update(pageCache, (currentCache) => new Map([...currentCache, [cacheKey, page]]))

export const clearPageCache = (): Effect.Effect<void, never> => Ref.set(pageCache, new Map())

export const getOrComputeCachedPage = <E>(
  cacheKey: string,
  compute: Effect.Effect<string, E>
): Effect.Effect<{ readonly html: string; readonly cacheStatus: 'hit' | 'miss' }, E> =>
  Effect.gen(function* () {
    const cached = yield* getCachedPage(cacheKey)
    if (cached !== undefined) {
      return { html: cached.html, cacheStatus: 'hit' as const }
    }

    const html = yield* compute
    yield* setCachedPage(cacheKey, { html, timestamp: Date.now() })
    return { html, cacheStatus: 'miss' as const }
  })
