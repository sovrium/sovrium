/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeSidebarDisclosureListClasses,
  computeSidebarDisclosureStateClasses,
  computeSidebarDisclosureToggleClasses,
  computeSidebarMenuSubItemClasses,
} from '@/presentation/design/sidebar-default-classes'

/**
 * The classes a sidebar disclosure's toggle, nested list and state line
 * paint.
 */

export const TOGGLE_CLASS = computeSidebarDisclosureToggleClasses()

export const LIST_CLASS = computeSidebarDisclosureListClasses()

export const STATE_CLASS = computeSidebarDisclosureStateClasses()

/** A nested `<ul>`'s shadcn part name and classes, spread onto the element. */
export const SUB_LIST = { 'data-slot': 'sidebar-menu-sub', className: LIST_CLASS } as const

/** A nested `<li>`'s shadcn part name and classes, spread onto the element. */
export const SUB_ITEM = {
  'data-slot': 'sidebar-menu-sub-item',
  className: computeSidebarMenuSubItemClasses(),
} as const

/** The `data-*` of a nested row: its shadcn part name and size, and `data-active` when current. */
export const subButtonAttributes = (isCurrent: boolean): Record<string, string> => ({
  'data-slot': 'sidebar-menu-sub-button',
  'data-size': 'md',
  ...(isCurrent ? { 'aria-current': 'page', 'data-active': '' } : {}),
})
