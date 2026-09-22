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
 * The string includes the storage key, every transform parameter, the resolved
 * output format, and the bucket the request named. Two requests producing
 * byte-identical output map to the same canonical string; two requests
 * producing different output do not.
 *
 * The bucket participates even though it never changes the BYTES. Both the
 * cache and the `ETag` are consulted BEFORE storage, so without it a request
 * naming a sibling bucket would hit the owning bucket's cached entry — or match
 * its `ETag` and be answered 304 — without the storage layer ever checking
 * which bucket owns the object.
 */
const canonicalString = (
  key: string,
  params: TransformParams,
  resolvedFormat: string,
  bucket: string
): string =>
  [
    key,
    `w=${params.width ?? ''}`,
    `h=${params.height ?? ''}`,
    `fit=${params.fit}`,
    `fmt=${resolvedFormat}`,
    `q=${params.quality ?? ''}`,
    // LAST on purpose: `evictTransformCacheForKey` drops entries by the
    // `<storageKey>|` prefix, so the storage key has to stay leading.
    `bkt=${bucket}`,
  ].join('|')

/**
 * Derive the in-memory transform-cache key for a request.
 *
 * @param key - the storage key of the source file
 * @param params - the parsed transform parameters
 * @param resolvedFormat - the output format actually produced (`'origin'` when
 *   the source format is preserved)
 * @param bucket - the bucket the request named, so one bucket's cached bytes
 *   can never be served through another
 */
export const buildTransformCacheKey = (
  key: string,
  params: TransformParams,
  resolvedFormat: string,
  bucket: string
): string => canonicalString(key, params, resolvedFormat, bucket)

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
