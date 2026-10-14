/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The closed date control: the trigger button that opens the calendar, and the
 * full-width block it sits in.
 *
 * The server-rendered placeholder and the hydrated island both read this
 * module, so the control does not move or resize on mount: an unstyled
 * placeholder would take its caption's width and the browser's default height,
 * then jump to the column-wide trigger and push everything below it down.
 */

import { FOCUS_VISIBLE_RING, RADIUS_MD } from './shared-tokens-default-classes'

type TriggerState = 'default' | 'open' | 'disabled'

/**
 * The block the trigger (and, once open, the calendar) sits in.
 *
 * `block w-full`, not `inline-block`: a shrink-to-fit root left the trigger's
 * `w-full` resolving against its own caption, so the control took the width
 * its label needed rather than the width of the column it was placed in.
 * `relative` anchors the floating calendar to it.
 */
export const DATE_CONTROL_ROOT_CLASSES = 'relative block w-full'

const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-50'

/**
 * The trigger's box.
 *
 * `w-full` and NO minimum: the root is a full-width block, so `w-full` is the
 * column's width, and any floor would overflow a column narrower than it.
 */
const TRIGGER_LAYOUT =
  'inline-flex h-9 w-full items-center justify-between gap-2 px-3 py-2 text-base'

const TRIGGER_SURFACE = [
  'border',
  'border-border',
  'bg-card',
  'text-foreground',
  'hover:bg-muted',
].join(' ')

const TRIGGER_OPEN = [
  'aria-expanded:border-ring',
  'aria-expanded:ring-1',
  'aria-expanded:ring-ring',
].join(' ')

const TRIGGER_MOTION = 'transition-[box-shadow,border-color,background-color] duration-150'

/**
 * Compute the default className for the closed-state date-picker trigger
 * button — the `aria-haspopup="dialog"` control that opens the calendar
 * popup. Mirrors the select trigger shape (bordered raised surface, focus
 * ring) so a row of date-pickers and selects reads as one cohesive form.
 * Open state lights up the border via the `aria-expanded` attribute the
 * island wires.
 *
 * The trigger casts NO shadow. Its border already separates it from the page,
 * and doubling a border with an elevation reads as two competing signals for
 * one edge — so the bound is the border alone.
 */
export const computeDateTriggerClasses = ({
  state = 'default',
}: {
  state?: TriggerState
} = {}): string =>
  [
    TRIGGER_LAYOUT,
    RADIUS_MD,
    TRIGGER_SURFACE,
    TRIGGER_MOTION,
    FOCUS_VISIBLE_RING,
    TRIGGER_OPEN,
    DISABLED,
    state === 'disabled' ? 'cursor-not-allowed opacity-50' : '',
  ]
    .filter(Boolean)
    .join(' ')
