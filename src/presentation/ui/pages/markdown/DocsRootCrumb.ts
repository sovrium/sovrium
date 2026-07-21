/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  getTabLabel,
  sectionHasTab,
  tabOfSection,
} from '@/presentation/ui/pages/markdown/DocsSidebarTabs'
import type { CollectionNavEntry } from '@/presentation/rendering/content-dir-lister'

export interface DocsRootCrumb {
  readonly name: string
  readonly href: string
}

export const resolveDocsRootCrumb = (
  sidebar: readonly CollectionNavEntry[],
  current: CollectionNavEntry,
  lang: string | undefined
): DocsRootCrumb | undefined => {
  if (!sidebar.some((entry) => sectionHasTab(entry.group))) return undefined
  const activeZone = tabOfSection(current.group)
  const landing = sidebar.find((entry) => tabOfSection(entry.group) === activeZone)
  if (landing === undefined) return undefined
  return { name: getTabLabel(activeZone, lang), href: landing.href }
}
