/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const TRAILING_DYNAMIC_SEGMENT = /\/:([^/]+?)\*?$/

export const deriveContentDirIndexBasePath = (path: string): string | undefined => {
  if (!TRAILING_DYNAMIC_SEGMENT.test(path)) return undefined
  const basePath = path.replace(TRAILING_DYNAMIC_SEGMENT, '')
  return basePath === '' ? '/' : basePath
}

export const deriveTrailingDynamicParamName = (path: string): string | undefined =>
  path.match(TRAILING_DYNAMIC_SEGMENT)?.[1]
