/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui data-table, separator and button (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `filter-bar` on shadcn/ui's anatomy: the toolbar of the data-table
 * example (`DataTableToolbar` / `DataTableFacetedFilter`).
 *
 *   - each applied condition is a faceted filter (`filter-bar-condition`): a
 *     dashed outline `sm` shell holding the field's label, a vertical
 *     `separator`, a `secondary` badge with the operator and value, and a
 *     ghost icon button that lifts it;
 *   - the add control is an outline `sm` button with a plus glyph, opening
 *     the condition builder on the popover surface (the popover's own recipe
 *     is `islands/overlays/popover-default-classes.ts`).
 *
 * The badge, button and input strings are the shared recipes
 * (`badge-default-classes.ts`, `button-variant-classes.ts`,
 * `input-default-classes.ts`); only the parts
 * shadcn/ui has no part for are written here.
 */

import { computeBadgeClasses } from './badge-default-classes'
import { computePartButtonClasses } from './button-variant-classes'
import { computeInputDefaultClasses } from './input-default-classes'

/** The bar's row: conditions, then the add control; wrapping, never scrolling. */
export const FILTER_BAR_ROW_CLASSES = 'flex flex-wrap items-center gap-2'

/**
 * One applied condition: the faceted filter's trigger shape — an outline `sm`
 * button's height, radius and type, on a dashed edge — drawn as a group
 * rather than a button, because it holds the remove button.
 */
export const FILTER_BAR_CONDITION_CLASSES =
  'inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-dashed border-border bg-background pr-0.5 pl-2.5 text-[0.8rem] font-medium text-foreground'

/** The vertical separator between the label and the value: shadcn/ui's `Separator`. */
export const FILTER_BAR_SEPARATOR_CLASSES = 'mx-0.5 h-4 w-px shrink-0 bg-border'

/** The operator and value, as the faceted filter's `secondary` badge. */
export const FILTER_BAR_VALUE_CLASSES = computeBadgeClasses({ variant: 'secondary' })

/** The ghost icon button that lifts a condition. */
export const FILTER_BAR_REMOVE_CLASSES = computePartButtonClasses({
  variant: 'ghost',
  size: 'icon-xs',
})

/** The add control: an outline `sm` button with its plus glyph. */
export const FILTER_BAR_ADD_CLASSES = computePartButtonClasses({ variant: 'outline', size: 'sm' })

/** The anchor the builder's popover hangs from. */
export const FILTER_BAR_ANCHOR_CLASSES = 'relative inline-flex'

/** Where the popover sits: under the add control, at its start edge. */
export const FILTER_BAR_POPOVER_PLACEMENT_CLASSES = 'absolute top-full left-0 mt-1'

/** The builder's rows inside the popover. */
export const FILTER_BAR_BUILDER_ROW_CLASSES = 'flex flex-wrap items-center gap-1'

/**
 * A field or operator option: a small toggle, muted until pressed, on the
 * popover's `muted` hover; the field row in the medium weight.
 */
export const computeFilterBarOptionClasses = ({
  active,
  strong = false,
}: {
  readonly active: boolean
  readonly strong?: boolean
}): string =>
  [
    'inline-flex h-7 items-center rounded-md px-2 text-[0.8rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
    active
      ? 'bg-muted text-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    strong ? 'font-medium' : '',
  ]
    .filter(Boolean)
    .join(' ')

/** The value control — a text box or a `<select>` — on shadcn/ui's `Input`. */
export const FILTER_BAR_VALUE_CONTROL_CLASSES = computeInputDefaultClasses()

/** The builder's Apply button: the default `sm` button, ending the builder. */
export const FILTER_BAR_APPLY_CLASSES = `${computePartButtonClasses({ variant: 'default', size: 'sm' })} self-end`
