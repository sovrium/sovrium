/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { findMatchingRoute } from '@/domain/utils/matching/route-matcher'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

const hasNonPublicAccess = (access: Page['access']): boolean =>
  access !== undefined && access !== 'all'

const DYNAMIC_PAGE_SIGNALS: readonly ((page: Page) => boolean)[] = [
  (page) => hasNonPublicAccess(page.access),
  (page) => page.collection !== undefined,
  (page) => page.dataSource !== undefined,
  (page) => page.contentDir !== undefined,
  (page) => page.source !== undefined,
  (page) => page.markdown !== undefined,
  (page) => page.presence === true,
  (page) => page.layout?.sidebar !== undefined,
  (page) => page.path.includes(':'),
]

function componentTreeHasDataSource(items: readonly unknown[]): boolean {
  return items.some((item) => {
    if (item === null || typeof item !== 'object') return false
    const node = item as Record<string, unknown>
    if ('$ref' in node || 'component' in node) return false
    if (node.dataSource !== undefined) return true
    const { children } = node
    return Array.isArray(children) ? componentTreeHasDataSource(children) : false
  })
}

export const isPageCacheable = (page: Page): boolean =>
  !DYNAMIC_PAGE_SIGNALS.some((signal) => signal(page)) &&
  !componentTreeHasDataSource(page.components)

export function isRenderablePathCacheable(app: App, path: string): boolean {
  const { pages } = app
  if (!pages || pages.length === 0) return path === '/'

  const match = findMatchingRoute(
    pages.map((page) => page.path),
    path
  )
  if (!match) return path === '/'

  const page = pages[match.index]
  return page ? isPageCacheable(page) : path === '/'
}
