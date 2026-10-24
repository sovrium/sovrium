/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isLocalizedPagePath, type DeclaredPagePath } from '@/domain/kernel/matching/localized-path'

/**
 * One address, one page: no two pages may declare the same path.
 *
 * The router serves `/menu` and `/menu/` at one address (a trailing slash is
 * answered with a 301 to the bare path), so two pages declaring it leave one of
 * them unreachable with nothing said. Paths are therefore compared after
 * {@link normalizeRoutePath}, which is the comparison the router makes. A
 * static path beside a dynamic one under it (`/menu`, `/menu/:slug`) shares no
 * address and passes.
 *
 * Only plain string paths are compared here. A page whose `path` is a
 * per-language map is judged by the localized address clash check
 * (`localized-path-validation.ts`), which compares every address a map claims
 * against every other page's.
 */

/** The page shape this check reads. */
export interface PageForPathUniqueness {
  readonly name: string
  readonly path: DeclaredPagePath
}

/** A refusal: the index of the page that repeats an address, and why. */
export interface DuplicatePagePath {
  readonly index: number
  readonly message: string
}

/**
 * A page path as the router compares it: every trailing slash dropped, the
 * root path kept as `/`.
 */
export const normalizeRoutePath = (path: string): string => path.replace(/\/+$/, '') || '/'

/**
 * The first page that declares an address an earlier page already declared,
 * or `undefined` when every page has an address of its own.
 *
 * The message names both pages, in declaration order, and the address written
 * without its trailing slash.
 */
export const findDuplicatePagePath = (
  pages: ReadonlyArray<PageForPathUniqueness>
): DuplicatePagePath | undefined =>
  pages
    .map((page, index) => {
      const { path } = page
      if (isLocalizedPagePath(path)) return undefined
      const address = normalizeRoutePath(path)
      const first = pages.findIndex(
        (other) => !isLocalizedPagePath(other.path) && normalizeRoutePath(other.path) === address
      )
      return first === index
        ? undefined
        : {
            index,
            message: `Pages "${pages[first]?.name}" and "${page.name}" both claim ${address}`,
          }
    })
    .find((duplicate) => duplicate !== undefined)
