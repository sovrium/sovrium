/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two bars that frame the rows and speak about the SET rather than about
 * any record in it — the pager footer with its page-size select and step
 * buttons, and the selection bar that sits above the header row.
 *
 * Neither is chrome the grid always shows: the pager appears when there is more
 * than one page, the bulk bar when something is selected. Both therefore have
 * to announce themselves without competing with the data, which is the one
 * design rule they share — the bulk bar is a NEUTRAL well rather than a primary
 * tint, and the pager speaks at caption weight, below the values it counts.
 * A selection bar in the accent hue reads as a banner the page has thrown, and
 * that is the defect this tone choice ends.
 *
 * The step buttons compose `button-default-classes.ts` and shrink its 28px to
 * 26px through {@link swapUtility}; see `table-class-swap.ts` for why that is a
 * token swap rather than a second class appended.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { computeButtonDefaultClasses } from './button-default-classes'
import { swapUtility } from './table-class-swap'

// ──────────────────────────────────────────────────────────────────────────────
// PAGER — the footer bar, its page-size select and its step buttons
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `display:flex; align-items:center; gap:8px; padding:6px 8px;
// font-size:11px; color:#707070; border-top:1px solid #e3e3e3`.
//
// The type step is the change that matters: the footer shipped at 14px, one
// step ABOVE the 12px values it paginates, so the loudest text on the grid was
// the chrome counting it. 11px muted puts it where a caption belongs.
const TABLE_PAGER = [
  'flex items-center gap-2 px-2 py-1.5 text-xs',
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

/**
 * Compute the default className for a pager bar.
 *
 * `position` decides which EDGE carries the rule — a footer separates itself
 * from the rows above, a header pager from the rows below — and nothing else.
 * JUSTIFICATION stays with the caller: the page-number pager spreads its
 * summary and its steps apart, while the load-more control centres its single
 * button, and both are properties of what that bar holds rather than of the
 * bar.
 */
export const computeTablePagerClasses = ({
  position = 'bottom',
}: {
  readonly position?: 'top' | 'bottom'
} = {}): string =>
  [
    TABLE_PAGER,
    position === 'top' ? 'border-b' : 'border-t',
    `border-[${v('sv-border', T.border)}]`,
  ].join(' ')

// Canvas: `height:26px; width:auto; padding:2px 8px; font-size:11px`.
//
// `w-auto` is explicit rather than implied: a `<select>` in a flex row stretches
// to its content's widest option unless told otherwise, and the page-size list
// holds `100 / page`, which is wider than the control needs to be at rest.
const TABLE_PAGER_SELECT = [
  'h-6 w-auto border px-2 py-0.5 text-xs',
  `rounded-[${v('radius-base', T.radiusBase)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
].join(' ')

/** Compute the default className for the pager's page-size `<select>`. */
export const computeTablePagerSelectClasses = (): string => TABLE_PAGER_SELECT

/** The `sm` button height, and the 26px the pager shrinks it to. */
const PAGER_BUTTON_FROM_HEIGHT = 'h-7'
const PAGER_BUTTON_TO_HEIGHT = 'h-6'

/**
 * Compute the default className for a pager step button (Previous / Next).
 *
 * The shared secondary button at `sm`, shrunk from 28px to 26px. That is a real
 * two-pixel divergence and it is deliberate: the pager's own bar is 11px type
 * inside 6px padding, and a 28px control inside it is taller than the bar it
 * sits in — the button would set the footer's height rather than the footer
 * setting the button's. The `sm` height is REPLACED rather than overridden, so
 * only one `h-*` reaches the element.
 */
export const computeTablePagerButtonClasses = ({
  disabled = false,
}: {
  readonly disabled?: boolean
} = {}): string =>
  swapUtility(
    computeButtonDefaultClasses({
      variant: 'secondary',
      size: 'sm',
      state: disabled ? 'disabled' : 'default',
    }),
    PAGER_BUTTON_FROM_HEIGHT,
    PAGER_BUTTON_TO_HEIGHT
  )

// ──────────────────────────────────────────────────────────────────────────────
// BULK BAR — the selection bar that sits ABOVE the header row
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `display:flex; align-items:center; gap:10px; padding:6px 8px;
// font-size:12px; border-bottom:1px solid #e3e3e3; background:#f4f4f4`.
//
// A NEUTRAL well, where this shipped as `bg-primary-subtle` — a primary tint.
// The two resolve to the same lightness in the default design, so most readers
// see no change; what changes is what an app that overrides `primary` to a
// saturated brand hue gets, which was a bar washed in it. Selection is chrome
// reporting a count, not a call to action, and it should not take the colour
// that belongs to controls.
const TABLE_BULK_BAR = [
  'flex items-center gap-2.5 border-b px-2 py-1.5 text-sm',
  `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  `border-[${v('sv-border', T.border)}]`,
].join(' ')

/** Compute the default className for the bulk-actions bar. */
export const computeTableBulkBarClasses = (): string => TABLE_BULK_BAR

/**
 * Compute the default className for the bulk bar's `N selected` count.
 *
 * MONO, and that is the whole of what this part adds. The count changes on
 * every click, and in a proportional face `1 selected` and `11 selected` are
 * different widths — so the label beside it, and every button after it, shifts
 * sideways each time the reader ticks a row. Tabular digits hold the row still.
 */
export const computeTableBulkBarCountClasses = (): string =>
  `font-mono text-sm text-[${v('sv-fg', T.fg)}]`
