/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui popover and command (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `search-input` component's own parts. Its box is shadcn/ui's
 * `InputGroup` (`input-group-default-classes.ts`), with the magnifier in an
 * addon at its start; what is the search box's own is the list of results it
 * opens under itself in the `page` scope.
 *
 * The list sits on base-nova's popover surface — `bg-popover`, a 1px
 * foreground ring at 10 %, `rounded-lg`, `shadow-md`, `p-1` — and each result
 * is a command-style row: `rounded-md px-2 py-1.5 text-sm`, on the accent
 * ground while hovered or highlighted. A row shows the page title over its
 * excerpt in the muted tone.
 */

/** The search box's root: the input group's width, the anchor of its results. */
export const computeSearchInputRootClasses = (): string => 'relative w-full'

/** The results list, on the popover surface, anchored under the box. */
export const computeSearchInputResultsClasses = (): string =>
  'absolute top-full right-0 left-0 z-50 m-0 mt-1 max-h-96 list-none overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10'

/** One result row. */
export const computeSearchInputItemClasses = (): string =>
  'flex cursor-pointer flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground'

/** A result's page title. */
export const computeSearchInputItemTitleClasses = (): string => 'block font-medium'

/** A result's excerpt, two lines at most. */
export const computeSearchInputItemExcerptClasses = (): string =>
  'line-clamp-2 text-xs text-muted-foreground'
