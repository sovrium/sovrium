/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One paint for an option value drawn as a badge, on every surface.
 *
 * A `single-select` or `status` value is drawn as a chip in three places — a
 * grid cell, a list item's badge, a kanban footer badge — and a reader must
 * see ONE chip for one value wherever it appears. This module is the one place
 * that decides that chip's paint, for both forms `design.badgeForm` names:
 *
 *   - `filled` (default) — the option colour is the chip's fill, with the
 *     AA-paired foreground and the edge the platform derives from it;
 *   - `outline-dot` — a transparent chip with an outline, and a leading dot in
 *     the option colour.
 *
 * An option with no colour is the NEUTRAL chip in both forms — the grid's
 * status pill, transparent with a strong outline — and never gains a hue the
 * author did not declare.
 *
 * `surface` says which chip the paint lands on. The grid's pill is already the
 * neutral outline, so it needs no neutral paint; the list and board chips wear
 * a filled secondary recipe, so they are repainted to the same neutral outline.
 *
 * Read by the data-table island in the browser, and on the server to resolve
 * the list and board paints ahead of time, which keeps the colour arithmetic
 * out of those two islands.
 */

import { deriveOptionChipColors } from '@/domain/kernel/color/option-chip-color'
import { TOKENS as T } from '@/presentation/design/css-var'
import type { CSSProperties } from 'react'

/** The app-wide badge form (`design.badgeForm`). */
export type BadgeForm = 'filled' | 'outline-dot'

/** A chip's leading dot: its classes and its option-colour fill. */
export interface OptionChipDot {
  readonly className: string
  readonly style: CSSProperties
}

/** A chip's inline paint, and its leading dot when it has one. */
export interface OptionChipPaint {
  readonly style?: CSSProperties
  readonly dot?: OptionChipDot
}

/**
 * The leading dot's classes — a 6px disc that never shrinks. Carried IN the
 * paint so a surface drawing a server-resolved paint imports nothing to draw it.
 */
const DOT_CLASSES = 'size-1.5 shrink-0 rounded-full'

/** Where the chip is drawn: the grid's outline pill, or a filled list/board chip. */
export type ChipSurface = 'grid' | 'chip'

/** The neutral outline: no fill, the page's strong edge. */
const NEUTRAL_OUTLINE: CSSProperties = {
  backgroundColor: 'transparent',
  borderColor: `var(--sv-border-strong, ${T.borderStrong})`,
}

/** The paint of a chip whose option declares no colour (or none a chip can use). */
const neutralPaint = (surface: ChipSurface): OptionChipPaint | undefined =>
  surface === 'grid' ? undefined : { style: NEUTRAL_OUTLINE }

/**
 * The paint for one option value's chip.
 *
 * @param color - the matched option's declared `#RRGGBB`, or `undefined`
 * @param form - `design.badgeForm`; `filled` when the app declares none
 * @param surface - the chip being painted
 * @returns the paint, or `undefined` when the chip keeps its own classes
 */
export function resolveOptionChipPaint(
  color: string | undefined,
  form: BadgeForm | undefined,
  surface: ChipSurface
): OptionChipPaint | undefined {
  const derived = color === undefined ? undefined : deriveOptionChipColors(color)
  if (derived === undefined) return neutralPaint(surface)
  if (form === 'outline-dot') {
    return {
      ...neutralPaint(surface),
      dot: { className: DOT_CLASSES, style: { backgroundColor: derived.fill } },
    }
  }
  return {
    style: {
      backgroundColor: derived.fill,
      color: derived.foreground,
      border: `1px solid ${derived.border}`,
    },
  }
}
