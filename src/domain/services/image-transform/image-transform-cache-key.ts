/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure derivation of the cache key + ETag for an on-the-fly image transform.
 *
 * A transform result is uniquely identified by the storage key plus the exact
 * transform parameters plus the negotiated output format (which itself depends
 * on the request `Accept` header when no explicit `format` was supplied).
 * Both the in-memory cache key and the HTTP `ETag` are derived from the same
 * canonical string so they always agree.
 */

import type { TransformParams } from './image-transform-params'

/**
 * Build a stable, canonical string identifying a transform request.
 *
 * The string includes the storage key, every transform parameter, and the
 * resolved output format. Two requests producing byte-identical output map to
 * the same canonical string; two requests producing different output do not.
 */
const canonicalString = (key: string, params: TransformParams, resolvedFormat: string): string =>
  [
    key,
    `w=${params.width ?? ''}`,
    `h=${params.height ?? ''}`,
    `fit=${params.fit}`,
    `fmt=${resolvedFormat}`,
    `q=${params.quality ?? ''}`,
  ].join('|')

/**
 * Derive the in-memory transform-cache key for a request.
 *
 * @param key - the storage key of the source file
 * @param params - the parsed transform parameters
 * @param resolvedFormat - the output format actually produced (`'origin'` when
 *   the source format is preserved)
 */
export const buildTransformCacheKey = (
  key: string,
  params: TransformParams,
  resolvedFormat: string
): string => canonicalString(key, params, resolvedFormat)

/**
 * Derive a quoted, weak-safe HTTP `ETag` value from a transform-cache key.
 *
 * The ETag is a content hash of the canonical request string — it changes
 * whenever the source key or any transform parameter changes, so a stale
 * `If-None-Match` never produces a false 304.
 */
export const buildTransformETag = (cacheKey: string): string => {
  const hash = Bun.hash(cacheKey).toString(16)
  return `"${hash}"`
}
