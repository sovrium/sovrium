/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui input-group and button (https://ui.shadcn.com), registry commit 30a58d4498f270af1c1e981a7d78a15cf5740841.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

import { computePartButtonClasses } from './button-variant-classes'

/**
 * The `input-group` component's parts, drawn on shadcn/ui's `InputGroup`
 * anatomy (base-nova).
 *
 * The group is ONE box: the border, the radius and the focus ring live on the
 * `role="group"` element (`data-slot="input-group"`), and the addons and the
 * field sit inside it borderless (`input-group-addon`, `input-group-control`).
 * The focus ring follows the field through the group's `has-[…]` rule, so it
 * draws around the whole pair rather than around the field alone.
 *
 * A leading mark (a single symbol glyph such as a magnifier) is drawn one step
 * larger than a word, so it reads at icon size beside 16px glyphs.
 */

/** The outer wrapper — the label's block and the group beneath it. */
export const computeInputGroupRootClasses = (): string => 'flex w-full flex-col gap-2'

/** The label above the group, bound to the field: shadcn/ui `FieldLabel` over `Label`. */
export const computeInputGroupLabelClasses = (): string =>
  'flex w-fit items-center gap-2 text-sm leading-snug font-medium select-none'

/** shadcn/ui `InputGroup`, in a leaf module the frames of other types share. */
export { computeInputGroupClasses } from './input-group-root-classes'

/** shadcn/ui `InputGroupInput`, in a leaf module beside the root. */
export { computeInputGroupFieldClasses } from './input-group-field-classes'

const ADDON_BASE =
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4"

/** shadcn/ui `inputGroupAddonVariants`, the four alignments. */
const ADDON_ALIGN = {
  'inline-start': 'order-first pl-2 has-[>button]:ml-[-0.3rem] has-[>kbd]:ml-[-0.15rem]',
  'inline-end': 'order-last pr-2 has-[>button]:mr-[-0.3rem] has-[>kbd]:mr-[-0.15rem]',
  'block-start':
    'order-first w-full justify-start px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2',
  'block-end':
    'order-last w-full justify-start px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2',
} as const

/** Where an addon sits. */
export type InputGroupAddonAlign = keyof typeof ADDON_ALIGN

/** A single symbol glyph rather than a word. */
const isMark = (content: string | undefined): boolean =>
  content !== undefined && /^\p{So}$/u.test(content)

/**
 * shadcn/ui `InputGroupAddon` (its `text-sm` type step); a lone mark is drawn
 * one step up instead, at icon size.
 */
export const computeInputGroupAddonClasses = ({
  align,
  content,
}: {
  readonly align: InputGroupAddonAlign
  readonly content?: string
}): string => `${ADDON_BASE} ${ADDON_ALIGN[align]} ${isMark(content) ? 'text-lg' : 'text-sm'}`

/** shadcn/ui `InputGroupTextarea`: the multi-line control, borderless inside the group. */
export const computeInputGroupTextareaClasses = (): string =>
  'w-full min-w-0 flex-1 resize-none rounded-none border-0 bg-transparent px-2.5 py-2 text-base shadow-none ring-0 outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 md:text-sm dark:bg-transparent dark:disabled:bg-transparent'

/** A key hint inside an addon: shadcn/ui's `Kbd`. */
export const computeInputGroupKbdClasses = (): string =>
  'pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none'

const ACTION_BASE =
  "group/button inline-flex shrink-0 items-center justify-center gap-1 rounded-[calc(var(--radius)-3px)] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap no-underline shadow-none transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted dark:hover:bg-muted/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&>svg:not([class*='size-'])]:size-3.5"

/** The attached control's look, over the ghost recipe above: shadcn/ui's button variants. */
const ACTION_VARIANT = {
  ghost: 'text-foreground hover:bg-muted hover:text-foreground',
  default: 'bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border-border bg-background hover:bg-muted',
  destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  link: 'text-primary underline-offset-4 hover:bg-transparent hover:underline',
} as const

/** The attached control's size: shadcn/ui's `InputGroupButton` sizes. */
const ACTION_SIZE = {
  xs: 'h-6 px-1.5',
  sm: 'h-7 px-2.5',
  'icon-xs': 'size-6 p-0',
  'icon-sm': 'size-8 p-0',
} as const

export type InputGroupActionVariant = keyof typeof ACTION_VARIANT
export type InputGroupActionSize = keyof typeof ACTION_SIZE

/** shadcn/ui `InputGroupButton`, as the link the group's action is: ghost and `xs` by default. */
export const computeInputGroupActionClasses = ({
  variant = 'ghost',
  size = 'xs',
}: {
  readonly variant?: InputGroupActionVariant
  readonly size?: InputGroupActionSize
} = {}): string => [ACTION_BASE, ACTION_VARIANT[variant], ACTION_SIZE[size]].join(' ').trim()
/**
 * shadcn/ui `InputGroupButton` at its `icon-xs` size: a ghost square holding a
 * glyph, the step buttons of a number input. base-nova draws it as `Button`
 * (ghost, `icon-xs`) with the group's `shadow-none p-0` on top.
 */
export const computeInputGroupIconButtonClasses = (): string =>
  `${computePartButtonClasses({ variant: 'ghost', size: 'icon-xs' })} shadow-none p-0`
