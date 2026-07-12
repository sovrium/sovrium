/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { DEVELOPER_NAV_PAGES, type DeveloperNavPage } from '@/domain/utils/admin-developer-nav'
import type { FamilyIcon } from './admin-sidebar-families'

export { DEVELOPER_NAV_SECTION_LABEL } from '@/domain/utils/admin-developer-nav'

export interface DeveloperNavItem extends DeveloperNavPage {
  readonly icon: FamilyIcon
}

const DEVELOPER_NAV_ICONS: Readonly<Record<string, FamilyIcon>> = {
  api: 'script',
  mcp: 'ai',
}

export const DEVELOPER_NAV_ITEMS: ReadonlyArray<DeveloperNavItem> = DEVELOPER_NAV_PAGES.map(
  (page) => ({
    ...page,
    icon: DEVELOPER_NAV_ICONS[page.key] ?? 'script',
  })
)
