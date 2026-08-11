/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Presentation projection of the Native Admin Dashboard sidebar's
 * **Developers** section.
 *
 * The icon-free page contract (key / label / href) is the cross-layer source of
 * truth in the domain (`@/domain/utils/admin-developer-nav`). Here we decorate
 * each page with its presentation-only `icon` glyph (the shared `FamilyIcon`
 * set, `admin-sidebar-icon.tsx`) so the Developers section reads as the same
 * design language as the Data nav above it.
 */

import { DEVELOPER_NAV_PAGES, type DeveloperNavPage } from '@/domain/utils/admin-developer-nav'
import type { FamilyIcon } from './admin-sidebar-families'

export { DEVELOPER_NAV_SECTION_LABEL } from '@/domain/utils/admin-developer-nav'

/** One Developers row: the domain page contract plus its presentation glyph. */
export interface DeveloperNavItem extends DeveloperNavPage {
  /** Inline-SVG glyph key (shared `FamilyIcon` set) for the page's row. */
  readonly icon: FamilyIcon
}

/** The presentation-only glyph per Developers destination key. */
const DEVELOPER_NAV_ICONS: Readonly<Record<string, FamilyIcon>> = {
  api: 'script',
  mcp: 'ai',
}

/** The two Developers rows — the domain pages decorated with each page's glyph. */
export const DEVELOPER_NAV_ITEMS: ReadonlyArray<DeveloperNavItem> = DEVELOPER_NAV_PAGES.map(
  (page) => ({
    ...page,
    icon: DEVELOPER_NAV_ICONS[page.key] ?? 'script',
  })
)
