/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { DATA_NAV_PAGES, type DataNavPage } from '@/domain/utils/admin-data-nav'
import type { FamilyIcon } from './admin-sidebar-families'

export {
  DATA_NAV_SECTION_LABELS,
  DATA_NAV_SECTION_ORDER,
  type DataNavSection,
} from '@/domain/utils/admin-data-nav'

export interface DataNavItem extends DataNavPage {
  readonly icon: FamilyIcon
}

const DATA_NAV_ICONS: Readonly<Record<string, FamilyIcon>> = {
  tables: 'table',
  automations: 'automation',
  pages: 'page',
  forms: 'form',
  users: 'admin',
  buckets: 'bucket',
  agents: 'agent',
  connections: 'connection',
}

export const DATA_NAV_ITEMS: ReadonlyArray<DataNavItem> = DATA_NAV_PAGES.map((page) => ({
  ...page,
  icon: DATA_NAV_ICONS[page.key] ?? 'table',
}))
