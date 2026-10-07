/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type EntryCacheControl } from '@/infrastructure/assets/client-entry-hash'
import { isProduction as isProductionEnv } from '@/infrastructure/process/env'

/**
 * The Cache-Control answers the static-asset routes give: a short cache for
 * stable names in production, none in development, and a year for a
 * content-hashed name.
 */

export const isProduction = isProductionEnv()

/**
 * Build Cache-Control header value for static assets.
 *
 * Production: 1-hour public cache for performance.
 * Development: no caching so asset changes are immediately visible.
 */
export function getCacheControlHeader(): string {
  return isProduction ? 'public, max-age=3600' : 'no-store, no-cache, must-revalidate'
}

/** A content-hashed asset: its name changes whenever its bytes do. */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/**
 * Cache-Control for the client entries, by the kind of name they were asked for.
 *
 * Production: a hashed name is pinned for a year. A STABLE name gets `no-cache`
 * — the browser may keep the bytes, but must revalidate them (against the
 * `ETag`) on every use. The content behind a stable name changes on every
 * release while the chunks it imports are replaced, so any freshness window is
 * a window in which a returning visitor runs the previous release's entry
 * against chunks that no longer exist. Rendered pages ask for the hashed names;
 * the stable ones only answer HTML cached from an older release.
 */
export const ENTRY_CACHE_CONTROL: EntryCacheControl = isProduction
  ? { hashed: IMMUTABLE_CACHE_CONTROL, stable: 'no-cache' }
  : { hashed: getCacheControlHeader(), stable: getCacheControlHeader() }

/** Content-hashed chunk names (`accordion-island-1a2b3c4d.js`) — safe to pin. */
const CONTENT_HASHED_ASSET = /-[a-z0-9]{8}\.js$/
const isContentHashed = (name: string): boolean => CONTENT_HASHED_ASSET.test(name)

/**
 * `immutable` only for content-hashed names (the name changes when the content
 * does). Stable names change content across releases under a fixed URL, so
 * they get the short cache. The prebuilt island entry never reaches this: see
 * `servePrebuiltIslandEntry`.
 */
export function assetCacheControl(name: string): string {
  return isProduction && isContentHashed(name) ? IMMUTABLE_CACHE_CONTROL : getCacheControlHeader()
}
