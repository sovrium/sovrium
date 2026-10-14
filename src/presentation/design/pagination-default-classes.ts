/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui pagination and button (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `pagination` on shadcn/ui's anatomy: base-nova's `ui/pagination.tsx`,
 * server-rendered, one `data-slot` per part.
 *
 *   nav[data-slot=pagination]
 *     ul[data-slot=pagination-content]
 *       li[data-slot=pagination-item] > button[data-slot=pagination-link]
 *       li[data-slot=pagination-item] > span[data-slot=pagination-ellipsis]
 *
 * base-nova's `PaginationLink` IS a `Button`: `outline` for the current page,
 * `ghost` for the rest, `size: icon` for a page number and `size: default`
 * for Previous and Next. The button strings below are base-nova's
 * `buttonVariants`, copied rather than read from the `button` recipe so the
 * pager keeps its own shape whatever the `button` type's departures are.
 *
 * Departures, written down in the type's fragment: a page is a `<button>`
 * (the schema gives a page no address), and the gap marker shows `...` as
 * text rather than base-nova's dots icon.
 */

/** The `<nav>`: centred across its row. */
export const PAGINATION_CLASSES = 'mx-auto flex w-full justify-center'

/** The `<ul>`. */
export const PAGINATION_CONTENT_CLASSES = 'flex items-center gap-0.5'

/**
 * base-nova's `buttonVariants` base string, minus `border-transparent`: without
 * tailwind-merge it would outrank `outline`'s `border-border`, so the ghost
 * variant names it instead.
 */
const BUTTON_BASE =
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

const BUTTON_OUTLINE =
  'border-border bg-background hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50'

const BUTTON_GHOST =
  'border-transparent hover:bg-muted hover:text-foreground dark:hover:bg-muted/50'

const BUTTON_SIZE_ICON = 'size-8'

const BUTTON_SIZE_DEFAULT =
  'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2'

/** A page number's `<button>`: an outline square when current, ghost otherwise. */
export const computePaginationLinkClasses = (isActive: boolean): string =>
  [BUTTON_BASE, isActive ? BUTTON_OUTLINE : BUTTON_GHOST, BUTTON_SIZE_ICON].join(' ')

/** Previous (`edge: 'start'`) or Next (`edge: 'end'`): a ghost button with its chevron. */
export const computePaginationEdgeClasses = (edge: 'start' | 'end', iconOnly = false): string =>
  iconOnly
    ? [BUTTON_BASE, BUTTON_GHOST, BUTTON_SIZE_ICON].join(' ')
    : [
        BUTTON_BASE,
        BUTTON_GHOST,
        BUTTON_SIZE_DEFAULT,
        edge === 'start' ? 'pl-1.5!' : 'pr-1.5!',
      ].join(' ')

/** The label inside Previous / Next, hidden below `sm` (the button keeps its name). */
export const PAGINATION_EDGE_LABEL_CLASSES = 'hidden sm:block'

/** The `...` gap marker. */
export const PAGINATION_ELLIPSIS_CLASSES =
  "flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4"
