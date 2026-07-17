/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { matchRoute, type RouteParams } from '@/domain/utils/matching/route-matcher'
import {
  deriveContentDirIndexBasePath,
  deriveTrailingDynamicParamName,
} from './content-dir-index-base-path'
import type { Page } from '@/domain/models/app/pages'

export interface ContentDirIndexBaseMatch {
  readonly page: Page
  readonly basePathPattern: string
  readonly indexSlug: string
  readonly routeParams: RouteParams
}

export const matchContentDirIndexBasePath = (
  pages: readonly Page[],
  path: string
): ContentDirIndexBaseMatch | undefined =>
  pages
    .map((page): ContentDirIndexBaseMatch | undefined => {
      const indexSlug = page.contentDir?.index
      if (indexSlug === undefined) return undefined
      const basePathPattern = deriveContentDirIndexBasePath(page.path)
      if (basePathPattern === undefined) return undefined
      const result = matchRoute(basePathPattern, path)
      if (!result.matched) return undefined
      const slugParam = deriveTrailingDynamicParamName(page.path)
      const routeParams: RouteParams =
        slugParam !== undefined ? { ...result.params, [slugParam]: indexSlug } : result.params
      return { page, basePathPattern, indexSlug, routeParams }
    })
    .find((match): match is ContentDirIndexBaseMatch => match !== undefined)
