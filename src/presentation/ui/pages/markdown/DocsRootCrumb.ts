/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

export interface DocsRootCrumb {
  readonly name: string
  readonly href: string
}

export const resolveDocsRootCrumb = (
  sidebar: readonly CollectionNavEntry[],
  current: CollectionNavEntry,
  tabs: CollectionNavTabs | undefined
): DocsRootCrumb | undefined => {
  if (!hasDocsTabs(tabs)) return undefined
  const activeTab = tabOfSection(current.group, tabs)
  if (activeTab === undefined) return undefined
  const href =
    activeTab.href ??
    sidebar.find((entry) => tabOfSection(entry.group, tabs)?.id === activeTab.id)?.href
  if (href === undefined) return undefined
  return { name: getTabLabel(activeTab), href }
}
