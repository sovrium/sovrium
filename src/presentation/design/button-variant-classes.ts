/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui button (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * base-nova's `buttonVariants`, for the buttons a component draws INSIDE its
 * own anatomy — a pad's Clear and Sign, a row's grip handle, a menu trigger, a
 * toggle link, a comment's Save and Delete, a confirmation's Cancel and
 * Confirm — as opposed to the `button` component type, whose recipe
 * (`button-default-classes.ts`) carries the schema's own variant vocabulary.
 *
 * Only the variants and sizes those parts draw are here; the strings are
 * base-nova's own, minus the `cn-*` hooks the shadcn CLI rewrites at install.
 * The caller stamps `data-slot="button"` beside the class, as shadcn's
 * `Button` does.
 *
 * base-nova's base carries `border-transparent` and its `outline` variant
 * `border-border`, and `tailwind-merge` drops the loser. A part's button is
 * drawn by islands too, which cannot carry that merge, so the transparent edge
 * moves from the base into the variants that keep it: the same classes the
 * merge produces, by construction rather than by resolution.
 *
 * Two known departures, kept for the chat island's mount budget rather than by
 * design: `secondary` hovers at `bg-secondary/80` where the registry mixes 5 %
 * of the foreground into the ground, and the base keeps `rounded-lg`, `text-sm`
 * and the 16px svg size that the `sm` / `icon-*` sizes replace — Tailwind
 * orders those same-property pairs by name, so the base's win. The `button`
 * component type's recipe (`button-default-classes.ts`) carries neither.
 */

/** The variants a part's button draws. */
export type PartButtonVariant =
  'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'

/** The sizes a part's button draws. */
export type PartButtonSize = 'default' | 'sm' | 'icon-xs' | 'icon-sm'

const BUTTON_BASE =
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/**
 * The two variants the always-loaded confirm gate draws, exported on their own
 * so that runtime pays for these strings and not for the whole table.
 */
export const PART_BUTTON_OUTLINE =
  'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50'

export const PART_BUTTON_DESTRUCTIVE =
  'border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40'

/** The `sm` size, which the confirm gate draws both its affordances at. */
export const PART_BUTTON_SM =
  "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5"

const BUTTON_VARIANT: Readonly<Record<PartButtonVariant, string>> = {
  default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
  outline: PART_BUTTON_OUTLINE,
  secondary:
    'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
  ghost:
    'border-transparent hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
  destructive: PART_BUTTON_DESTRUCTIVE,
  link: 'border-transparent text-primary underline-offset-4 hover:underline',
}

const BUTTON_SIZE: Readonly<Record<PartButtonSize, string>> = {
  default: 'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
  sm: PART_BUTTON_SM,
  'icon-xs':
    "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
  'icon-sm': 'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
}

/**
 * A part's button from one variant string and one size string, in the order
 * {@link computePartButtonClasses} writes them.
 */
export const joinPartButtonClasses = (variant: string, size: string): string =>
  `${BUTTON_BASE} ${variant} ${size}`

/** The className of a part's button, at base-nova's variant and size. */
export const computePartButtonClasses = ({
  variant = 'default',
  size = 'default',
}: {
  readonly variant?: PartButtonVariant
  readonly size?: PartButtonSize
} = {}): string => joinPartButtonClasses(BUTTON_VARIANT[variant], BUTTON_SIZE[size])
