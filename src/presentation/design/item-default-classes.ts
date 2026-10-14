/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cva } from 'class-variance-authority'

/**
 * Adapted from shadcn/ui item (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * base-nova's `Item`, at its default variant and size — a leaf module, so an
 * island that draws an item (a map's list twin) imports these strings alone.
 * `display-default-classes.ts` re-exports it for the server-rendered surfaces.
 */

/**
 * Item state axis:
 *   - `'default'`  — regular row
 *   - `'selected'` — the currently-selected row, on the muted ground
 *   - `'disabled'` — dimmed row (opacity-50 + cursor-not-allowed)
 */
export type ListItemState = 'default' | 'selected' | 'disabled'

/** base-nova's `itemVariants` base, with `variant: default` and `size: default`. */
const ITEM_BASE =
  'group/item flex w-full flex-wrap items-center rounded-lg border text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-muted border-transparent gap-2.5 px-3 py-2.5'

/**
 * Compute the className for one `item` row. base-nova's default item, plus
 * Sovrium's two axes: `interactive` (a row bound to an action takes the
 * pointer and the hover ground base-nova gives a linked item) and `state`.
 */
export const computeListItemClasses = ({
  state = 'default',
  interactive = false,
}: {
  readonly state?: ListItemState
  readonly interactive?: boolean
} = {}): string =>
  [
    ITEM_BASE,
    ...(interactive && state !== 'disabled' ? ['cursor-pointer hover:bg-muted'] : []),
    ...(state === 'selected' ? ['bg-muted'] : []),
    ...(state === 'disabled' ? ['opacity-50 cursor-not-allowed'] : []),
  ].join(' ')

/**
 * The parts of base-nova's `Item` that sit INSIDE a row: `ItemMedia`,
 * `ItemContent`, `ItemTitle`, `ItemDescription` and `ItemActions`, stamped
 * `data-slot="item-media"` and so on by their renderers.
 *
 * The row itself stays `computeListItemClasses` (the `item` base already
 * ported for the list); {@link computeItemClasses} only adds the variant
 * axis on top of it, so there is one copy of the row and nothing forked.
 */

/** base-nova's `itemVariants.variant`. */
export type ItemVariant = 'default' | 'outline' | 'muted'

/**
 * The row: the list's `item` base with base-nova's `variant` on top.
 *
 * Derived per call rather than held in a module-level table: `String.replace`
 * is a call the bundler cannot prove pure, so a table holding one ships to
 * every island that reads only `computeListItemClasses` from this module.
 */
export const computeItemClasses = ({
  variant = 'default',
}: { readonly variant?: ItemVariant } = {}): string => {
  if (variant === 'outline') return ITEM_BASE.replace('border-transparent', 'border-border')
  if (variant === 'muted') return `${ITEM_BASE} bg-muted/50`
  return ITEM_BASE
}

/** base-nova's `itemMediaVariants.variant`. */
export type ItemMediaVariant = 'default' | 'icon' | 'image'

const ITEM_MEDIA_BASE =
  'flex shrink-0 items-center justify-center gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start [&_svg]:pointer-events-none'

const ITEM_MEDIA_VARIANT = cva('', {
  variants: {
    variant: {
      default: 'bg-transparent',
      icon: "[&_svg:not([class*='size-'])]:size-4",
      image:
        'size-10 overflow-hidden rounded-sm group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-full [&_img]:object-cover',
    },
  },
})

/** `ItemMedia`: the leading icon or picture. */
export const computeItemMediaClasses = ({
  variant = 'default',
}: { readonly variant?: ItemMediaVariant } = {}): string =>
  `${ITEM_MEDIA_BASE} ${ITEM_MEDIA_VARIANT({ variant: variant })}`

/** `ItemContent`: the column holding the title and the description. */
export const computeItemContentClasses = (): string =>
  'flex flex-1 flex-col gap-1 group-data-[size=xs]/item:gap-0 [&+[data-slot=item-content]]:flex-none'

/** `ItemTitle`. */
export const computeItemTitleClasses = (): string =>
  'line-clamp-1 flex w-fit items-center gap-2 text-sm leading-snug font-medium underline-offset-4'

/** `ItemDescription`. */
export const computeItemDescriptionClasses = (): string =>
  'line-clamp-2 text-left text-sm leading-normal font-normal text-muted-foreground group-data-[size=xs]/item:text-xs [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary'

/** `ItemActions`: the trailing controls. */
export const computeItemActionsClasses = (): string => 'flex items-center gap-2'
