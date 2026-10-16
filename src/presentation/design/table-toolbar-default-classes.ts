/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui button, input and badge (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The bar ABOVE the grid, on shadcn/ui's Data Table toolbar: one row of
 * `outline` / `sm` buttons at the 32px the example sets (`h-8`), a dashed
 * outline for the controls that narrow the rows (the faceted-filter trigger's
 * look), a `secondary` badge for a count, and the `Input` narrowed for search.
 *
 * The button strings are base-nova's `buttonVariants`, copied rather than read
 * from the `button` recipe — the same choice the pager made — so the grid keeps
 * shadcn's shape whatever the `button` type's own departures are. A toolbar
 * PANEL is a band inside the grid's frame and lives in
 * `table-panel-default-classes.ts`; a menu floats and lives in the overlay
 * recipes.
 */

/**
 * base-nova's `buttonVariants` base string, minus `border-transparent`: without
 * tailwind-merge that class would outrank the outline variant's `border-border`
 * in the stylesheet, so each variant names its own border colour instead.
 */
export const TABLE_BUTTON_BASE =
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/** `variant: outline`, resting; an `aria-expanded` control wears the well. */
const OUTLINE_RESTING =
  'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50'

/** `variant: outline`, drawn in the well its `aria-expanded` state wears. */
const OUTLINE_ACTIVE = 'border-border bg-muted text-foreground dark:border-input dark:bg-input/50'

/** `variant: default`. */
const DEFAULT_VARIANT = 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80'

/** `size: sm`, raised to the example's `h-8`. */
export const TABLE_BUTTON_SIZE_SM =
  "h-8 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5"

/** `variant: ghost`. */
export const TABLE_BUTTON_GHOST =
  'border-transparent hover:bg-muted hover:text-foreground dark:hover:bg-muted/50'

/** `size: icon-xs`. */
export const TABLE_BUTTON_SIZE_ICON_XS =
  "size-6 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3"

/**
 * The part a toolbar button names on its element, as base-nova's `Button` does:
 * `data-slot`, `data-variant` and `data-size`, so a hand-drawn toolbar button
 * reads as the same `outline` / `sm` (or `default` / `sm`) button the `button`
 * type renders, to a stylesheet and to a test alike.
 */
export const TABLE_TOOLBAR_BUTTON_PART = {
  'data-slot': 'button',
  'data-variant': 'outline',
  'data-size': 'sm',
} as const

/** The part of the toolbar's one `default` / `sm` button. */
export const TABLE_TOOLBAR_PRIMARY_BUTTON_PART = {
  'data-slot': 'button',
  'data-variant': 'default',
  'data-size': 'sm',
} as const

/**
 * A secondary toolbar control: `outline` / `sm` at 32px.
 *
 * `active` draws the control in the well an open control wears, for a state
 * that is not an `aria-expanded` (a builder holding committed rows). `dashed`
 * is the faceted-filter trigger's border, for the controls that narrow the
 * rows. `disabled` draws the disabled look for a caller that does not set the
 * attribute.
 */
export const computeTableToolbarButtonClasses = ({
  active = false,
  disabled = false,
  dashed = false,
}: {
  readonly active?: boolean
  readonly disabled?: boolean
  readonly dashed?: boolean
} = {}): string =>
  [
    TABLE_BUTTON_BASE,
    active ? OUTLINE_ACTIVE : OUTLINE_RESTING,
    TABLE_BUTTON_SIZE_SM,
    dashed ? 'border-dashed' : '',
    disabled ? 'pointer-events-none opacity-50' : '',
  ]
    .filter((c) => c !== '')
    .join(' ')

/**
 * The toolbar's ONE primary control, `+ New record`, and the panel commits that
 * share its weight: `variant: default` / `sm` at 32px.
 */
export const computeTableToolbarPrimaryButtonClasses = (): string =>
  [TABLE_BUTTON_BASE, DEFAULT_VARIANT, TABLE_BUTTON_SIZE_SM].join(' ')

/**
 * A matched substring inside a searched cell: a neutral WELL, never a hue, so
 * it does not compete with the colours the record data already owns.
 */
export const computeTableSearchHitClasses = (): string => `bg-muted`
