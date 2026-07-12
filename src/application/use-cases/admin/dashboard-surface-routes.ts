/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { DATA_NAV_PAGES } from '@/domain/utils/admin-data-nav'

const DATA_PAGE_KEYS: ReadonlySet<string> = new Set(DATA_NAV_PAGES.map((page) => page.key))

export type DataRoute = { readonly page?: string; readonly object?: string }

export function parseDataRoute(dashboardPath: string): DataRoute | undefined {
  const segments = dashboardPath.split('/').filter((segment) => segment.length > 0)
  if (segments.length === 0) return {}
  const page = segments[0]
  if (!page || !DATA_PAGE_KEYS.has(page)) return undefined
  if (segments.length === 1) return { page }
  if (segments.length === 2 && segments[1]) return { page, object: segments[1] }
  return undefined
}
