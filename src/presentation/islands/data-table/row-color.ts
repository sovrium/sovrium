/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a grid ROW turns its `rowColorField` value into painted colours, and what
 * happens to the chrome that already lives on that row.
 *
 * The fourth surface in the `colorField` family, and the only one where the
 * author's fill lands somewhere the PLATFORM also draws: a kanban card, a
 * calendar event and a timeline bar each own their whole box, but a grid row is
 * also where striping, hover and selection are painted.
 *
 * Resolution goes through the shared `resolveRecordColor` seam the three record
 * views use, with an EMPTY fallback palette. That emptiness is the rule, not an
 * omission: [[internal ref] A7](../../../../docs/architecture/decisions/024-restraint-as-the-design-default.md)
 * ruling 5 makes declared colour an opt-in, and a grid has never invented a hue
 * per row — so a value declaring none is not filled, exactly as on a kanban card.
 */

import { useCallback, useMemo, useState } from 'react'
import { resolveRecordColor } from '@/domain/kernel/color/record-color'
import type { TableRecord } from '../runtime/types'
import type { OptionChipColors } from '@/domain/kernel/color/option-chip-color'
import type { CSSProperties } from 'react'

/**
 * The grid paints nothing for an undeclared value. Hoisted so the empty array
 * is one shared reference rather than a fresh allocation per row per render.
 */
const NO_FALLBACK_PALETTE: readonly string[] = []

/**
 * The fill / foreground / border one row should paint for its own
 * `rowColorField` value, or `undefined` when this row carries no fill.
 *
 * `undefined` is returned for all three "no fill" cases, and they must stay
 * indistinguishable to the caller: no `rowColorField` declared, a row whose
 * value is empty, and a value whose option declares no colour. Each one leaves
 * the row on today's striping / hover / selection untouched.
 */
export function resolveRowColors(
  record: TableRecord,
  rowColorField: string | undefined,
  optionColors: Readonly<Record<string, string>> | undefined
): OptionChipColors | undefined {
  if (rowColorField === undefined) return undefined
  const value = record[rowColorField]
  if (value === null || value === undefined || value === '') return undefined
  return resolveRecordColor(String(value), optionColors, NO_FALLBACK_PALETTE)
}

/**
 * The non-fill mark a FILLED row wears when it is selected and/or hovered.
 *
 * Both cues are `box-shadow` insets rather than a background, because on a
 * filled row the background belongs to the app author (A7 ruling 1 names row
 * selection as chrome, and chrome must not overwrite someone else's datum).
 * They are visually distinct from each other so a hovered row never reads as a
 * selected one: selection is a full ring, hover a left edge.
 *
 * The colour is the fill's DERIVED foreground — the higher-contrast of black
 * and white — so the mark is legible over any hue an author picks. That is a
 * provable floor, not a preference: `deriveOptionChipColors` guarantees at
 * least 4.58:1 against the fill, comfortably past the 3:1 WCAG asks of a
 * non-text indicator. The derived BORDER would not do; at 28% toward the
 * foreground it lands near 1.9:1 on a pale fill.
 */
export function rowChromeShadow(
  color: string,
  state: { readonly selected: boolean; readonly hovered: boolean }
): string | undefined {
  const layers = [
    ...(state.selected ? [`inset 0 0 0 2px ${color}`] : []),
    ...(state.hovered ? [`inset 4px 0 0 0 ${color}`] : []),
  ]
  return layers.length === 0 ? undefined : layers.join(', ')
}

/** Everything {@link buildRowStyle} needs, all primitives so it memoizes cleanly. */
export interface RowPaintInputs {
  /** The author's declared hex, or `undefined` on an unfilled row. */
  readonly fill: string | undefined
  /** The fill's derived AA foreground — text colour AND cue colour. */
  readonly cueColor: string | undefined
  readonly selected: boolean
  readonly hovered: boolean
  readonly clickable: boolean
}

/** Hoisted so an unfilled clickable row does not allocate a style per render. */
const CURSOR_ONLY: CSSProperties = { cursor: 'pointer' }

/**
 * The inline style a row wears, or `undefined` when it needs none.
 *
 * An UNFILLED row is deliberately untouched by everything below: it returns the
 * same shared cursor style (or nothing) the grid has always applied, so its
 * striping, hover and selection stay on the background utilities in
 * `DataRow`'s class list. Every shipped grid is that row.
 *
 * A FILLED row takes the author's hue as its background, the derived companion
 * as its text colour, and its chrome as a `box-shadow`.
 */
export function buildRowStyle(inputs: RowPaintInputs): CSSProperties | undefined {
  const { fill, cueColor, selected, hovered, clickable } = inputs
  if (fill === undefined || cueColor === undefined) {
    return clickable ? CURSOR_ONLY : undefined
  }
  const shadow = rowChromeShadow(cueColor, { selected, hovered })
  return {
    backgroundColor: fill,
    color: cueColor,
    ...(shadow !== undefined && { boxShadow: shadow }),
    ...(clickable && { cursor: 'pointer' }),
  }
}

/** What a row needs to paint itself, plus the handlers that keep it current. */
export interface RowPaint {
  /** True when this row carries an author fill and its chrome must move off it. */
  readonly filled: boolean
  /** The row's inline style, or `undefined` when it needs none. */
  readonly style: CSSProperties | undefined
  readonly onMouseEnter: () => void
  readonly onMouseLeave: () => void
}

/**
 * Resolve one row's fill and track its hover, in a single hook so the row
 * renderer stays a renderer.
 *
 * Hover is tracked in STATE rather than by a `hover:` utility because the cue's
 * colour is derived per row from the author's fill, and a CSS pseudo-class
 * cannot read a per-row inline value. The handlers are returned unconditionally
 * (hooks must be), but `DataRow` attaches them only to a filled row — so an
 * ordinary grid renders exactly the markup it always has.
 */
export function useRowPaint(
  record: TableRecord,
  rowColorField: string | undefined,
  optionColors: Readonly<Record<string, string>> | undefined,
  state: { readonly selected: boolean; readonly clickable: boolean }
): RowPaint {
  const [hovered, setHovered] = useState(false)
  const onMouseEnter = useCallback(() => setHovered(true), [])
  const onMouseLeave = useCallback(() => setHovered(false), [])

  const colors = resolveRowColors(record, rowColorField, optionColors)
  const { selected, clickable } = state
  const fill = colors?.fill
  const cueColor = colors?.foreground
  const style = useMemo(
    () => buildRowStyle({ fill, cueColor, selected, hovered, clickable }),
    [fill, cueColor, selected, hovered, clickable]
  )

  return { filled: colors !== undefined, style, onMouseEnter, onMouseLeave }
}
