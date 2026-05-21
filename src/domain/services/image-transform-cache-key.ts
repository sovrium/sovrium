/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { TransformParams } from './image-transform-params'

const canonicalString = (key: string, params: TransformParams, resolvedFormat: string): string => {
  const crop =
    params.crop.kind === 'focal' ? `focal:${params.crop.x},${params.crop.y}` : params.crop.kind
  return [
    key,
    `w=${params.width ?? ''}`,
    `h=${params.height ?? ''}`,
    `fit=${params.fit}`,
    `crop=${crop}`,
    `fmt=${resolvedFormat}`,
    `q=${params.quality ?? ''}`,
  ].join('|')
}

export const buildTransformCacheKey = (
  key: string,
  params: TransformParams,
  resolvedFormat: string
): string => canonicalString(key, params, resolvedFormat)

export const buildTransformETag = (cacheKey: string): string => {
  const hash = Bun.hash(cacheKey).toString(16)
  return `"${hash}"`
}
