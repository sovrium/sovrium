/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cva } from 'class-variance-authority'

/**
 * Adapted from shadcn/ui badge (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `badge` on shadcn/ui's anatomy: the base-nova `badgeVariants` recipe,
 * server-rendered.
 *
 * One root, `data-slot="badge"`, with `data-variant` naming the tone. The
 * base string and the six variant strings are base-nova's, unchanged; the
 * three status tones (`success`, `warning`, `info`) are Sovrium extensions on
 * the footing the alert's status tones stand on ([internal ref] D5).
 *
 * `destructive` is base-nova's TINT, not a solid fill: a 10 % destructive
 * ground under destructive ink. A badge is read, not actioned, so it states
 * its tone without the emphasis a destructive button claims.
 *
 * The navigation-menu island and the record picker still draw the older pill
 * from `navbar-default-classes.ts`; they move with their own families.
 */

/** The tones the schema's `badgeVariant` accepts: base-nova's six and three status tones. */
export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'ghost'
  | 'link'
  | 'success'
  | 'warning'
  | 'info'

/**
 * base-nova's `badgeVariants` base string, with two departures: the
 * horizontal padding is `design.density`'s gap step (`--sv-density-gap`)
 * instead of `px-2`, because the density ladder is documented to set the
 * gutter inside a badge; and `border-transparent` moves to the filled tones
 * (see {@link computeBadgeClasses}).
 */
const BADGE_BASE =
  'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border px-(--sv-density-gap) py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!'

/** base-nova's `badgeVariants` variant strings. */
const BADGE_VARIANT = cva('', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground [a]:hover:bg-primary/80',
      secondary:
        'border-transparent bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
      destructive:
        'border-transparent bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20',
      outline: 'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
      ghost: 'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
      link: 'text-primary underline-offset-4 hover:underline',
      // Sovrium's status tones: a tint of the theme's status solid under the
      // role's text colour (4.5:1 in both modes), as base-nova tints `destructive`.
      success: 'border-transparent bg-success-solid/15 text-success-fg',
      warning: 'border-transparent bg-warning-solid/15 text-warning-fg',
      info: 'border-transparent bg-info-solid/15 text-info-fg',
    },
  },
})

/**
 * Compute the className for a badge root of the given tone.
 *
 * base-nova's base draws `border-transparent` and lets `cn` replace it with
 * the outline's `border-border`. Here the transparent border sits in the three
 * filled tones instead, so the joined string carries one border colour and a
 * caller without the class merger (an island) still draws the outline.
 */
export const computeBadgeClasses = ({
  variant = 'default',
}: { variant?: BadgeVariant } = {}): string =>
  `${BADGE_BASE} ${BADGE_VARIANT({ variant: variant })}`
