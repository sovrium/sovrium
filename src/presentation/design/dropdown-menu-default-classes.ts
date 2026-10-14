/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui dropdown-menu (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * base-nova's dropdown-menu panel and rows, reachable by BOTH the islands'
 * menu family (`islands/overlays/menu-default-classes.ts`, which composes its
 * panel and item recipes from these strings) and the server-drawn menus — the
 * language switcher's — that no island draws. One copy of the panel, one of
 * the row.
 *
 * Strings are base-nova's own, minus the `cn-*` hooks the shadcn CLI rewrites
 * at install time and the `w-(--anchor-width)` a Base UI positioner provides.
 */

/** The panel's frame and motion, without its colours. */
export const MENU_CONTENT_FRAME =
  'z-50 max-h-(--available-height) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg p-1 shadow-md duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95'

/** The panel's popover surface: `bg-popover`, outlined by a 1px foreground ring at 10 %. */
export const MENU_CONTENT_SURFACE = 'bg-popover text-popover-foreground ring-1 ring-foreground/10'

/**
 * What every action row shares: the layout, the disabled state, the icon
 * sizing. A row's focus indicator is its accent fill, as in base-nova; the
 * page's global focus ring is cancelled on the row, which a `navigate` item
 * renders as a link.
 */
export const MENU_ITEM_FRAME =
  "relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus-visible:ring-0 focus-visible:ring-offset-0 data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/** The `dropdown-menu-content` panel, at its minimum width. */
export const computeDropdownMenuContentClasses = (): string =>
  `${MENU_CONTENT_FRAME} min-w-32 ${MENU_CONTENT_SURFACE}`

/**
 * A `dropdown-menu-radio-item` row: room at its end for the check that marks
 * the picked option, the accent fill while focused or hovered.
 */
export const computeDropdownMenuRadioItemClasses = (): string =>
  "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/** The `dropdown-menu-radio-item-indicator`: the check at the picked row's end. */
export const computeDropdownMenuRadioIndicatorClasses = (): string =>
  'pointer-events-none absolute right-2 flex items-center justify-center'
