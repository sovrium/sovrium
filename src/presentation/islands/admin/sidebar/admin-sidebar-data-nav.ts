/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Presentation projection of the Native Admin Dashboard sidebar's **Data** tab
 * taxonomy.
 *
 * The icon-free page contract (key / label / href / ready) is the cross-layer
 * source of truth in the domain (`@/domain/utils/admin-data-nav`), since both
 * this island AND the application surface builder consume it. Here we decorate
 * each domain page with its presentation-only `icon` glyph (the shared
 * `FamilyIcon` set, `admin-sidebar-icon.tsx`) so the Data tab reads as the same
 * design language as the Config tab. `DATA_NAV_ROOT` + `isDataPath` are
 * re-exported so the island and tab control import everything from one module.
 *
 * The dashboard sidebar carries a top-level Config / Data segmented control
 * (under the search trigger, above the zones). The **Config** tab lists the
 * object-first config zones (`admin-sidebar-families.ts`); the **Data** tab —
 * declared here — is a FLAT operator workspace of runtime-data destinations
 * (Stripe-Dashboard / Supabase-style), so an operator reaches records, runs,
 * analytics, submissions, and users WITHOUT drilling into each config object.
 */

import { DATA_NAV_PAGES, type DataNavPage } from '@/domain/utils/admin-data-nav'
import type { FamilyIcon } from './admin-sidebar-families'

export {
  DATA_NAV_SECTION_LABELS,
  DATA_NAV_SECTION_ORDER,
  type DataNavSection,
} from '@/domain/utils/admin-data-nav'

/** One Data-tab row: the domain page contract plus its presentation glyph. */
export interface DataNavItem extends DataNavPage {
  /** Inline-SVG glyph key (shared `FamilyIcon` set) for the page's row. */
  readonly icon: FamilyIcon
}

/** The presentation-only glyph per Data destination key (shared `FamilyIcon` set). */
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

/**
 * The eight Data-tab rows — the domain {@link DATA_NAV_PAGES} contract decorated
 * with each page's presentation glyph, in the same runtime-data-first order.
 */
export const DATA_NAV_ITEMS: ReadonlyArray<DataNavItem> = DATA_NAV_PAGES.map((page) => ({
  ...page,
  icon: DATA_NAV_ICONS[page.key] ?? 'table',
}))
