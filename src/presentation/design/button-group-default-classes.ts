/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui button-group (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * base-nova's `buttonGroupVariants`, for a component that draws a group of
 * its own buttons (a map's zoom pair). The caller stamps `role="group"`,
 * `data-slot="button-group"` and `data-orientation` beside the class, as
 * shadcn's `ButtonGroup` does, and each button inside carries
 * `data-slot="button"` so the joined edges square off.
 */

const BUTTON_GROUP_BASE =
  "flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 has-[>[data-slot=button-group]]:gap-2 [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1"

/**
 * The className of a horizontal group: the joined edges square off and every
 * button after the first drops its leading border.
 *
 * One export per orientation rather than one keyed function, so an island
 * drawing one orientation does not ship the other's strings.
 */
export const computeHorizontalButtonGroupClasses = (): string =>
  `${BUTTON_GROUP_BASE} *:data-slot:rounded-r-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-lg! [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0`

/** The className of a vertical group: the same joins, stacked. */
export const computeVerticalButtonGroupClasses = (): string =>
  `${BUTTON_GROUP_BASE} flex-col *:data-slot:rounded-b-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-lg! [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0`
