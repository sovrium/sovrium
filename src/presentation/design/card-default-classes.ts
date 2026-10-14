/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui card (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * base-nova's `Card` root, less `text-sm` (the card sets no type size): the
 * card ground and ring, the `--card-spacing` rhythm and the block padding.
 * A card drawn WITH its header/content/footer parts uses it as it is, since
 * those parts pad the inline axis themselves.
 */
export const CARD_SURFACE =
  'group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl'

/**
 * The `card` on shadcn/ui's anatomy: base-nova's `Card` root, server-rendered
 * as `div[data-slot=card][data-size=default]`.
 *
 * The surface is base-nova's: the `card` ground and foreground, `rounded-xl`,
 * and a faint `ring-1 ring-foreground/10` where the older recipe drew a
 * border. `--card-spacing` (16 px; 12 px at `data-size=sm`) spaces the
 * children and pads the edge.
 *
 * Two departures, both written down in the type's fragment:
 *
 * - **A card without slots pads all four sides itself.** base-nova pads only
 *   the block axis and lets `CardHeader`/`CardContent`/`CardFooter` pad the
 *   inline one; a card declaring no `title`, `description`, `action` or
 *   `footer` keeps its children directly in it, so its root adds
 *   `px-(--card-spacing)`. A card declaring one is laid out on the slots.
 * - **No `text-sm`.** The card does not set a type size: its children keep
 *   their own, as they always have.
 */
/** The surface alone: a sliced card's parts pad its inline edges themselves. */
const CARD_ROOT_SLICED = CARD_SURFACE

const CARD_ROOT = `${CARD_ROOT_SLICED} px-(--card-spacing)`

/**
 * The className of a `card`'s root, before the author's `className` is merged
 * over it (the author wins every same-property conflict).
 */
export const computeCardClasses = ({
  sliced = false,
}: { readonly sliced?: boolean } = {}): string => (sliced ? CARD_ROOT_SLICED : CARD_ROOT)

/** shadcn/ui `CardHeader`: the title, the description, and the action on the title row. */
export const computeCardHeaderClasses = (): string =>
  'group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)'

/** shadcn/ui `CardTitle`. */
export const computeCardTitleClasses = (): string =>
  'text-base leading-snug font-medium group-data-[size=sm]/card:text-sm'

/** shadcn/ui `CardDescription`. */
export const computeCardDescriptionClasses = (): string => 'text-sm text-muted-foreground'

/** shadcn/ui `CardAction`: pinned to the header's end, on the title row. */
export const computeCardActionClasses = (): string =>
  'col-start-2 row-span-2 row-start-1 self-start justify-self-end'

/** shadcn/ui `CardContent`: the body, inset by the card's spacing. */
export const computeCardContentClasses = (): string => 'px-(--card-spacing)'

/** shadcn/ui `CardFooter`: a muted band under the body. */
export const computeCardFooterClasses = (): string =>
  'flex items-center gap-2 rounded-b-xl border-t bg-muted/50 p-(--card-spacing)'

/** The `data-*` every card root carries: its shadcn part name and its size. */
export const CARD_SLOT_ATTRIBUTES = { 'data-slot': 'card', 'data-size': 'default' } as const

/**
 * base-nova's card parts, for a renderer that draws a card WITH them (a KPI,
 * a gallery card): `CardHeader`, `CardTitle` (less its `cn-font-heading`
 * hook, which only the registry's build gives a rule), `CardDescription`,
 * `CardAction`, `CardContent` and `CardFooter`.
 */
export const CARD_PART_CLASSES = {
  header:
    'group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)',
  title: 'text-base leading-snug font-medium group-data-[size=sm]/card:text-sm',
  description: 'text-sm text-muted-foreground',
  action: 'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
  content: 'px-(--card-spacing)',
  footer: 'flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)',
} as const
