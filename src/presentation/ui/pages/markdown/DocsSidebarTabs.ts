/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { humanizeFieldName } from '@/presentation/utils/string-utils'
import type { CollectionNavTabs } from '@/presentation/rendering/content-dir-lister'

export type DocsNavTab = CollectionNavTabs[number]

export const hasDocsTabs = (tabs: CollectionNavTabs | undefined): tabs is CollectionNavTabs =>
  tabs !== undefined && tabs.length > 0

export const sectionIsClaimed = (name: string | undefined, tabs: CollectionNavTabs): boolean =>
  name !== undefined && tabs.some((tab) => tab.sections.includes(name))

export const tabOfSection = (
  name: string | undefined,
  tabs: CollectionNavTabs
): DocsNavTab | undefined => {
  const owner = name === undefined ? undefined : tabs.find((tab) => tab.sections.includes(name))
  return owner ?? tabs[0]
}

export const getTabLabel = (tab: DocsNavTab): string => tab.label ?? humanizeFieldName(tab.id)
