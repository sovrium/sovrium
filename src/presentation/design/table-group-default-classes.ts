/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows that are NOT records — group headers and their aggregate cells, the
 * whole-view summary footer, the empty and no-match states, the pre-hydration
 * skeleton bar, and the trailing `+ New row` affordance with its inline editor.
 *
 * They sit together because they share one rule the record rows do not obey:
 * their padding and type step are FIXED and must never read the body's density
 * map. A group label that shrank with `rowHeight` would make the structure of a
 * grouped view depend on how tightly its records are packed, and a summary
 * footer that did the same would drift away from the group aggregates it is
 * meant to total. Both read the same map once, and both were wrong.
 *
 * The tone ladder is the other shared fact: a group header sits on GROUND, one
 * step lighter than the summary WELL beneath it, so a reader can tell a
 * partition from a total without reading either.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// GROUP ROW — a group header, its label cell and its summary cells
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `<tr style="background:#fafafa">` — GROUND, one step lighter than the
// `#f4f4f4` well that shipped. A group header divides the list; it is not a
// selected or emphasised row, and at the well's tone it competed with both.
const TABLE_GROUP_ROW = `bg-[${v('sv-bg', T.bg)}]`

/**
 * Compute the default className for a group header `<tr>`.
 *
 * The `group-header` class token stays on the element at the call site: spec
 * locators resolve groups by it, so it is a contract rather than styling.
 */
export const computeTableGroupRowClasses = (): string => TABLE_GROUP_ROW

// Canvas: `padding:4px 8px; font-size:11px; font-weight:500`.
//
// Fixed, like the header cell and for the same reason — a group label is chrome
// dividing the data, so it should not inflate when the reader asks for more air
// around the VALUES. It used to interpolate the body's density map.
const TABLE_GROUP_CELL = [
  'px-2 py-1 text-xs font-medium cursor-pointer',
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

/**
 * Compute the default className for a group header's label cell.
 *
 * `cursor-pointer` is part of the part rather than appended: the whole `<td>`
 * IS the collapse toggle (no inner `<button>`, because the spec's collapse
 * locator requires exactly one of `button`-or-header to resolve), so the
 * affordance is unconditional here in a way it is not on an ordinary cell.
 */
export const computeTableGroupCellClasses = (): string => TABLE_GROUP_CELL

// Canvas: `padding:4px 8px; font-size:11px; font-weight:500; color:#565656`.
// The muted tone is the change: a group's aggregates used to share the label's
// full-strength `fg`, so a number computed ABOUT the group read as loudly as
// the group's own name.
const TABLE_GROUP_SUMMARY_CELL = [
  'px-2 py-1 text-xs font-medium whitespace-nowrap',
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

/**
 * Compute the default className for one of a group row's summary cells.
 *
 * Covers both placements — the trailing `<td>`s aligned under their columns,
 * and the leading spans that fall inside the group-name cell when a summary
 * names column 0 or a column the grid does not show.
 */
export const computeTableGroupSummaryCellClasses = (): string => TABLE_GROUP_SUMMARY_CELL

/**
 * The per-level indent, in pixels, of a nested group's label.
 *
 * Applied as an inline `paddingLeft` of `level * TABLE_GROUP_INDENT_PX` rather
 * than as a class, and that is not a shortcut: a per-level utility cannot be
 * enumerated by a SCAN-FREE compiler, so a `pl-14` no other module names emits
 * no rule and renders as no indent at all. The shipped code worked around this
 * by repeating one already-compiled `pl-8` per level — correct, but it spends
 * 32px a level where the canvas spends 14, so a three-deep grouping pushed its
 * labels 64px off the edge.
 */
export const TABLE_GROUP_INDENT_PX = 14

// ──────────────────────────────────────────────────────────────────────────────
// SUMMARY ROW — the whole-view footer
// ──────────────────────────────────────────────────────────────────────────────

const TABLE_SUMMARY_ROW = [`bg-[${v('sv-bg-subtle', T.bgSubtle)}]`, 'font-medium'].join(' ')

/**
 * Compute the default className for a summary footer `<tr>`.
 *
 * The well fill stays: unlike the group header, a footer terminates the grid
 * and has the shell's bottom edge rather than more rows beneath it, so a filled
 * band reads as a base rather than as a division.
 */
export const computeTableSummaryRowClasses = (): string => TABLE_SUMMARY_ROW

// Canvas: `padding:6px 8px; font-size:11px; font-weight:500`.
//
// Fixed, NOT the body's density map — a footer holds one aggregate per column
// and has no reason to grow with the row height the reader picked for the data.
const TABLE_SUMMARY_CELL = [
  'px-2 py-1.5 text-xs font-medium whitespace-nowrap',
  `text-[${v('sv-fg', T.fg)}]`,
].join(' ')

/**
 * Compute the default className for a summary footer cell.
 *
 * Full-strength `fg`, where a GROUP summary is muted: a whole-view total is the
 * grid's own conclusion and the last thing read, while a group's is an aside
 * beside the group's name.
 */
export const computeTableSummaryCellClasses = (): string => TABLE_SUMMARY_CELL

// ──────────────────────────────────────────────────────────────────────────────
// EMPTY STATE — the empty and no-match messages
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `padding:26px; text-align:center; font-size:12px; color:#707070`.
//
// `py-6` is 24px against the canvas' 26 — a 2px rounding, accepted rather than
// spent as an arbitrary `py-[26px]`. The value is a comfortable centre for a
// one-line message, not a measured relationship to anything, so a ladder step
// is worth more than the two pixels.
const TABLE_EMPTY_STATE = [
  'py-6 px-2 text-center text-sm',
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

/**
 * Compute the default className for the empty-table and no-match cells.
 *
 * ONE recipe for both: they differ in what they SAY — "nothing here yet" versus
 * "nothing matched what you typed" — and the canvas' 4px padding difference
 * between them encodes nothing a reader can use. The message is the
 * information; the chrome around it should not be a second, quieter claim.
 *
 * The header row STAYS rendered above either message, which is what keeps an
 * empty grid legible as a grid with columns rather than as a blank panel.
 */
export const computeTableEmptyStateClasses = (): string => TABLE_EMPTY_STATE

// ──────────────────────────────────────────────────────────────────────────────
// SKELETON BAR — the pre-hydration pulse bar
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `height:8px; background:#e3e3e3; border-radius:2px`.
//
// An 8px bar on `sv-border`, down from a 16px bar on the well. A loading
// placeholder is a hint at where text will be, and at 16px on a filled tone it
// was heavier than the values it stands in for — so the grid visibly LIGHTENED
// on hydration, which reads as content failing to arrive.
const TABLE_SKELETON_BAR = [
  'h-2 animate-pulse',
  `rounded-[${v('radius-sm', T.radiusSm)}]`,
  `bg-[${v('sv-border', T.border)}]`,
].join(' ')

/**
 * Compute the default className for one skeleton pulse bar.
 *
 * WIDTH stays with the caller — the canvas varies it per column (70/50/40/45%)
 * so the placeholder reads as text of differing lengths rather than as a
 * regular grid of blocks.
 */
export const computeTableSkeletonBarClasses = (): string => TABLE_SKELETON_BAR

// ──────────────────────────────────────────────────────────────────────────────
// ADD ROW — the trailing `+ New row` affordance and its inline editor
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the resting add-row `<tr>`.
 *
 * GROUND (`sv-bg`), the same tone as a group header and a step below the body's
 * raised surface: the add row is not a record, and painting it at the records'
 * tone made an empty grid look like it held one.
 */
export const computeTableAddRowClasses = (): string => `bg-[${v('sv-bg', T.bg)}]`

/**
 * Compute the default className for the `+ New row` trigger.
 *
 * Muted at rest, full strength on hover — an affordance that is available
 * without asking to be used. `text-sm` (12px) rather than the 14px that
 * shipped: the trigger sat one step ABOVE the values it adds to.
 */
export const computeTableAddRowTriggerClasses = (): string =>
  [
    'text-sm font-medium',
    `text-[${v('sv-fg-muted', T.fgMuted)}]`,
    `hover:text-[${v('sv-fg', T.fg)}]`,
  ].join(' ')

// The canvas draws an in-grid editor as a NARROWED `.input` — 28px tall rather
// than the platform control height, because it has to sit inside a row without
// making that row taller than the ones above it.
const TABLE_ADD_ROW_INPUT = [
  'h-7 w-full border px-2 py-1 text-sm',
  `rounded-[${v('radius-base', T.radiusBase)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
  `text-[${v('sv-fg', T.fg)}]`,
  `focus:border-[${v('sv-primary', T.primary)}]`,
  `focus:ring-1 focus:ring-[${v('sv-focus-ring', T.focusRing)}] focus:outline-none`,
].join(' ')

/**
 * Compute the default className for a text control that sits INSIDE a grid row —
 * the add-row cell's input, and every inline cell editor's field.
 *
 * `border-strong` at rest rather than `border`: this control sits ON the grid's
 * own ruled surface, so an input drawn in the same tone as the cell borders
 * around it disappears into them.
 *
 * The cell editors call this rather than a name of their own. They are the same
 * control in the same place — a text box inside a row that must not grow taller
 * because of it — and they had drifted to `border-primary` on one side and
 * `border-strong` on the other, so an editor opened over a row looked unlike the
 * row waiting to be added below it. An alias under a second name was tried and
 * refused: `knip` reports two exported names for one value as a duplicate
 * export, correctly, since the second name is a synonym rather than a decision.
 */
export const computeTableAddRowInputClasses = (): string => TABLE_ADD_ROW_INPUT
