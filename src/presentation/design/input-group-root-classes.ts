/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui input-group (https://ui.shadcn.com), registry commit 30a58d4498f270af1c1e981a7d78a15cf5740841.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * shadcn/ui `InputGroup`'s root, alone in a leaf module.
 *
 * The `input-group` component, the tree's search box and the frames of the
 * comment composer and the two editors all draw it. A module several islands
 * import becomes a chunk of its own shipping every export, so the root sits
 * apart from the addons and the field: an island drawing only the frame pays
 * for the frame. `input-group-default-classes.ts` re-exports it.
 */

/** shadcn/ui `InputGroup`. */
/**
 * `fit` makes the group hug its content instead of spanning its column — a
 * compact control such as a number stepper, whose buttons belong beside the
 * value rather than at the column's far edges.
 */
export const computeInputGroupClasses = ({
  fit = false,
}: { readonly fit?: boolean } = {}): string =>
  `group/input-group relative flex h-8 ${fit ? 'w-fit' : 'w-full'} min-w-0 items-center rounded-lg border border-input transition-colors outline-none in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-disabled:bg-input/50 has-disabled:opacity-50 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto dark:bg-input/30 dark:has-disabled:bg-input/80 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5`
