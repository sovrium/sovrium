/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolve the docs-article breadcrumb ROOT crumb from the collection sidebar.
 *
 * For a collection that DECLARES its docs tabs (`contentDir.nav.tabs`, [internal ref])
 * the breadcrumb roots at the ACTIVE TAB (label + link) instead of the generic
 * "Home": the active tab owns the current article's section (an unclaimed section
 * falls back to the first tab), the crumb NAME is the tab's `label` (already
 * localised per locale, else the humanized id), and the crumb HREF is the tab's
 * `href` when set, else DERIVED from the first sidebar entry (in sidebar/sort
 * order) belonging to that tab — so it self-heals when the docs tree is
 * restructured. Returns `undefined` when the collection declares no tabs, so
 * untabbed documentation degrades to the historical "Home" root.
 *
 * Pure presentation helper (no I/O): the resolver supplies the already-listed
 * sidebar, the current entry, and the collection's declared tabs.
 */

import {
  getTabLabel,
  hasDocsTabs,
  tabOfSection,
} from '@/presentation/ui/pages/markdown/DocsSidebarTabs'
import type {
  CollectionNavEntry,
  CollectionNavTabs,
} from '@/presentation/rendering/content-dir-lister'

/** Root crumb: the active docs tab (label + the tab's landing href). */
export interface DocsRootCrumb {
  readonly name: string
  readonly href: string
}

/**
 * Resolve the tab root crumb, or `undefined` for a collection with no declared
 * tabs.
 *
 * @param sidebar - the full collection sidebar (all files, in sort order).
 * @param current - the entry whose route is being rendered.
 * @param tabs - the collection's declared `nav.tabs`, if any.
 */
export const resolveDocsRootCrumb = (
  sidebar: readonly CollectionNavEntry[],
  current: CollectionNavEntry,
  tabs: CollectionNavTabs | undefined
): DocsRootCrumb | undefined => {
  // Only a collection declaring its own IA gets the tab root; untabbed docs keep
  // the historical "Home" fallback.
  if (!hasDocsTabs(tabs)) return undefined
  const activeTab = tabOfSection(current.group, tabs)
  if (activeTab === undefined) return undefined
  // Landing = the configured `href`, else the first sidebar entry (in order)
  // whose section belongs to the active tab (self-healing default).
  const href =
    activeTab.href ??
    sidebar.find((entry) => tabOfSection(entry.group, tabs)?.id === activeTab.id)?.href
  if (href === undefined) return undefined
  return { name: getTabLabel(activeTab), href }
}
