/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { someComponentInTree } from '@/presentation/utils/component-template-walker'
import { ISLAND_COMPONENT_TYPES } from '@/presentation/utils/island-component-types'
import { isListIslandMode } from '@/presentation/utils/list-island-mode'
import { isRecordFieldSystemMode } from '@/presentation/utils/system-detail-mode'
import type { Components } from '@/domain/models/app/components'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

const ISLAND_ACTION_TYPES = new Set(['auth', 'crud', 'automation'])

function isSingleRecordBoundForm(item: Component): boolean {
  return (
    (item.type === 'form' || item.type === 'data-form') &&
    item.dataSource?.mode === 'single' &&
    typeof item.dataSource.table === 'string'
  )
}

function hasDataIslandProp(item: Component): boolean {
  const props = (item as Record<string, unknown>).props as Record<string, unknown> | undefined
  return typeof props?.['data-island'] === 'string'
}

function itemSelfNeedsIslands(item: Component): boolean {
  if (ISLAND_COMPONENT_TYPES.has(item.type)) return true
  if (hasDataIslandProp(item)) return true
  if (item.dataSource?.mode === 'search') return true
  if (isListIslandMode(item)) return true
  if (isRecordFieldSystemMode(item)) return true
  if (isSingleRecordBoundForm(item)) return true
  const action = (item as Record<string, unknown>).action as { type?: string } | undefined
  return action?.type !== undefined && ISLAND_ACTION_TYPES.has(action.type)
}

export function hasIslandComponents(page: Page, components?: Components): boolean {
  if (page.presence === true) return true
  return someComponentInTree(page.components, components, (item) =>
    itemSelfNeedsIslands(item as Component)
  )
}
