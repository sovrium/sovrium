/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui sidebar (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * Two of base-nova's sidebar menu parts, as a leaf module: the `<li>` and the
 * badge after a label. `sidebar-default-classes.ts` re-exports both; an island
 * reusing them off a sidebar (the `tree`) imports these strings alone.
 */

/** One `<li>` (`sidebar-menu-item`). */
const SIDEBAR_MENU_ITEM_CLASS = 'group/menu-item relative'

/**
 * The marker after a label (`sidebar-menu-badge`): base-nova's badge, in the
 * row's flow rather than absolutely placed.
 */
const SIDEBAR_ENTRY_BADGE_CLASS =
  'pointer-events-none ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none group-data-[collapsible=icon]/sidebar:hidden'

/** Compute the className for one `<li>` of a group's list. */
export const computeSidebarMenuItemClasses = (): string => SIDEBAR_MENU_ITEM_CLASS

/** Compute the className for an entry's badge (literal marker or live count). */
export const computeSidebarEntryBadgeClasses = (): string => SIDEBAR_ENTRY_BADGE_CLASS
