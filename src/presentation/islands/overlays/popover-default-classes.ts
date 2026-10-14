/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui popover and hover-card (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The popover and hover-card anatomy, as base-nova draws it: one class string
 * per `data-slot`.
 *
 * Both are anchored panels that grow out of their trigger (Base UI's
 * `--transform-origin`), slide in from the side they open on, and outline
 * themselves with a 1px foreground ring at 10 % rather than a border. Neither
 * draws an arrow. A hover card is a popover opened by resting the pointer, one
 * step narrower.
 */

/** The enter / exit motion both panels share, keyed on Base UI's `data-side`. */
const FLOATING_MOTION =
  'origin-(--transform-origin) outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95'

/** `popover-content`. */
const POPOVER_CONTENT = `z-50 flex w-72 flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 ${FLOATING_MOTION}`

const POPOVER_HEADER = 'flex flex-col gap-0.5 text-sm'

const POPOVER_TITLE = 'font-medium'

const POPOVER_DESCRIPTION = 'text-muted-foreground'

/** `hover-card-content`. */
const HOVER_CARD_CONTENT = `z-50 w-64 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 ${FLOATING_MOTION}`

/** The positioner both panels sit in: its own stacking context, above the page. */
const FLOATING_POSITIONER = 'isolate z-50'

/** The positioner around a popover or a hover card. */
export const computeFloatingPositionerClasses = (): string => FLOATING_POSITIONER

/** The popover panel. */
export const computePopoverContentClasses = (): string => POPOVER_CONTENT

/** The block holding the popover's title and description. */
export const computePopoverHeaderClasses = (): string => POPOVER_HEADER

/** The popover's heading. */
export const computePopoverTitleClasses = (): string => POPOVER_TITLE

/** The supporting sentence under the popover's title. */
export const computePopoverDescriptionClasses = (): string => POPOVER_DESCRIPTION

/** The hover card's panel. */
export const computeHoverCardContentClasses = (): string => HOVER_CARD_CONTENT
