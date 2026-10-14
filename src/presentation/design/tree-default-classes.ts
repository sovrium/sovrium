/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui sidebar-11 (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `tree` on the file tree of shadcn/ui's sidebar-11 block, drawn off a
 * sidebar: a menu of items, each branch a collapsible whose chevron turns a
 * quarter when open, its children in a sub-menu ruled on the left.
 *
 * Off a sidebar, the row takes the page's `accent` surface for hover and for
 * the selected item rather than the sidebar's own `sidebar-accent`, so a tree
 * placed on a card or a page reads like every other selectable row there.
 */

import {
  computeSidebarEntryBadgeClasses,
  computeSidebarMenuItemClasses,
} from '@/presentation/design/sidebar-menu-default-classes'

/** The tree list: base-nova's `sidebar-menu` layout. */
export const computeTreeClasses = (): string => 'flex w-full min-w-0 flex-col gap-1'

/** One item: base-nova's `sidebar-menu-item`, plus the keyboard focus ring the treeitem owns. */
export const computeTreeItemClasses = (): string =>
  `${computeSidebarMenuItemClasses()} rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring`

/**
 * The item's row: base-nova's `sidebar-menu-button` at its default size, on the
 * accent surface when hovered or selected (`data-active`). Its width and
 * padding transition is dropped: it animates a collapsing sidebar, and a tree
 * never collapses.
 */
export const computeTreeItemButtonClasses = (): string =>
  'flex h-8 cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 text-sm outline-hidden hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground'

/** The disclosure chevron: `ChevronRight`, turned a quarter while its branch is open. */
export const computeTreeChevronClasses = (open: boolean): string =>
  `size-4 shrink-0 text-muted-foreground transition-transform${open ? ' rotate-90' : ''}`

/** An open branch's children: base-nova's `sidebar-menu-sub`, ruled in the border colour. */
export const computeTreeSubClasses = (): string =>
  'mx-3.5 flex min-w-0 flex-col gap-1 border-l border-border px-2.5 py-0.5'

/** An item's count: base-nova's `sidebar-menu-badge`, set in the mono face. */
export const computeTreeCountClasses = (): string =>
  `${computeSidebarEntryBadgeClasses()} font-mono text-muted-foreground`
