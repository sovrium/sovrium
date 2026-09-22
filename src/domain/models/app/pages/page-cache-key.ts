/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The identity of one cached page render.
 *
 * Split out of `infrastructure/server/cache/page-cache-service.ts` in W5c. It
 * sat there by co-location rather than by dependency: the key builder touches
 * no `Ref`, no environment and no I/O — it concatenates values the caller has
 * already resolved. The cache STORE is infrastructure and stays where it is;
 * this is a pure function of the app's render checksum and the request's
 * dimensions, which is a domain concern and the reason the page routes can
 * build a key without reaching across a layer for one.
 *
 * ─── WHY EVERY SEGMENT IS PRESENT EVEN WHEN EMPTY ──────────────────────────
 *
 * The key is positional and fixed-arity: six segments, always, with `-` for an
 * absent dimension. A variable-arity key built by joining only the dimensions
 * that happen to be set would let two different requests collide — `language`
 * absent with `urlLanguage: 'en'` would produce the same string as `language:
 * 'en'` with `urlLanguage` absent — and the collision would serve one visitor
 * the other's page rather than failing.
 *
 * Any change here invalidates every live entry, which is harmless: entries are
 * keyed by the app render-checksum, so they are already unreachable after a
 * schema edit and the cache has no TTL to wait out.
 */

/**
 * Extra key dimensions beyond the path and the detected language.
 *
 * Grouped into one object so the builder keeps a readable call shape as
 * dimensions accrue — there are already three, and each arrived separately.
 */
export interface PageCacheKeyVariant {
  /** The `/:lang/` URL-prefix locale, when the request carried one. */
  readonly urlLanguage?: string
  /** The content corpus's checksum, for a `'content'` page. */
  readonly corpusChecksum?: string
  /** The resolved `page.query` / `page.window` values, pre-joined by the caller. */
  readonly queryVariant?: string
}

/**
 * Build the cache key for one page render.
 *
 * @param renderChecksum - The app's render checksum; changing it makes every
 *   older entry unreachable, which is how invalidation works here.
 * @param path - The request path the renderer was asked for.
 * @param language - Detected language code, or `undefined` for the default.
 * @param variant - The optional extra dimensions.
 */
export const getPageCacheKey = (
  renderChecksum: string,
  path: string,
  language: string | undefined,
  variant?: PageCacheKeyVariant
): string =>
  `${renderChecksum}:${path}:${language ?? 'default'}:${variant?.urlLanguage ?? '-'}:${variant?.corpusChecksum ?? '-'}:${variant?.queryVariant ?? '-'}`
