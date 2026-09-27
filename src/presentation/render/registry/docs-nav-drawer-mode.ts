/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/domain/models/app/pages'

/**
 * True when a page renders the docs layout's collection navigation, which
 * folds into the `sidebar-drawer` island below `lg` with nothing to configure.
 *
 * The markdown page has no component carrying the island, so neither walk over
 * `page.components` can see it; this is the page-level shape both call-sites
 * ask about, exactly as `presence: true` is. Shared by the TWO call-sites that
 * must agree — the page renderer's `pageNeedsIslands` (BUILD the bundle) and
 * `hasIslandComponents` (INJECT the script) — for the reason
 * `isSourcedSidebar` states: if they diverge, the menu button renders and never
 * opens, or the script tag 404s.
 */
export function pageFoldsDocsNav(page: Page): boolean {
  return page.markdown?.layout === 'docs' && page.contentDir?.nav?.enabled === true
}
