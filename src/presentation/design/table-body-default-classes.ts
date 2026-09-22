/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Everything the grid draws PER ROW — `<tbody>`, the row's four states, the
 * body `<td>` and its density, the keyboard cursor and fill affordances, a
 * pinned column's surface, the row-number ordinal and the selection checkbox.
 *
 * This is the only module in the family that reads `rowHeight`, and that is the
 * seam. A class here is emitted once per visible cell, so it is where the
 * density map belongs and where a wrong one is most expensive — a header cell
 * interpolating THIS map was the original defect. Everything drawn once per
 * grid is next door in `table-shell-default-classes.ts`.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import type { RowHeight } from '@/domain/models/app/pages/components/component-types/data/table/schema'

// ──────────────────────────────────────────────────────────────────────────────
// CELL — the body `<td>`
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `height:{36|44|56}px; vertical-align:middle; padding:4px 8px;
// font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap`.
//
// The row height becomes an EXPLICIT height rather than an emergent property of
// padding. Under the old map a row was as tall as its tallest cell's content
// plus padding, so a grid holding one two-line value had one row taller than
// the rest and the horizontal rhythm broke exactly where the eye scans. A
// declared height plus `overflow-hidden text-ellipsis` makes every row in a
// density identical by construction.
//
// The x-padding collapses from three values (12px at `short`, 16px at the other
// two) to one 8px. Density is a VERTICAL question — how many records fit on a
// screen — and coupling the horizontal gutter to it moved the columns sideways
// every time the reader changed row height.
const TABLE_CELL_BASE = [
  'px-2 py-1 align-middle text-sm',
  'overflow-hidden text-ellipsis whitespace-nowrap',
].join(' ')

const TABLE_CELL_HEIGHT: Readonly<Record<RowHeight, string>> = {
  short: 'h-9',
  medium: 'h-11',
  tall: 'h-14',
}

/**
 * Compute the default className for a body cell at a given row height.
 *
 * SUPERSEDES `ROW_HEIGHT_CLASSES` for the body cell — that map now delegates
 * here, so the density control and this recipe cannot disagree.
 *
 * `h-9` / `h-11` / `h-14` are 36 / 44 / 56px. On a `<td>` a `height` is a
 * MINIMUM rather than a cap (CSS table sizing treats it as such), so a cell
 * whose content genuinely needs more still gets it; what the declaration buys
 * is that a row of ordinary values is always exactly its density's height
 * instead of whatever its padding happened to sum to.
 */
export const computeTableCellClasses = ({ rowHeight }: { readonly rowHeight: RowHeight }): string =>
  `${TABLE_CELL_BASE} ${TABLE_CELL_HEIGHT[rowHeight]}`

// ──────────────────────────────────────────────────────────────────────────────
// BODY — the `<tbody>` the rows are bucketed into
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for a body group — every `<tbody>` the grid
 * emits, whether it holds the rows, the loading skeleton, the empty state or
 * one bucket of a grouped view.
 *
 * A grid emits MANY of these, not one: grouping puts each bucket in its own
 * `<tbody data-group>` so a spec can descend from the group into its rows, and
 * the empty and skeleton states are separate elements again. Five sites wrote
 * the same string out, which is five places to miss when the surface tone or
 * the row separator changes — and this module exists to have exactly one.
 *
 * It keeps the role alias spelling (`bg-background-raised`, `divide-border`)
 * that the five literals carried rather than the `v(…)` form its neighbours
 * use. Both resolve through the same variables — `--color-background-raised` is
 * declared as `var(--sv-bg-raised)` — so this is a move, not a redraw; picking
 * the vocabulary is a separate decision from having one place to make it.
 */
export const computeTableBodyClasses = (): string => 'divide-border bg-background-raised divide-y'

// ──────────────────────────────────────────────────────────────────────────────
// ROW — `<tr>` state
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The four states a body row can be painted in.
 *
 * They are EXCLUSIVE, which is the change from what shipped: striping, hover
 * and selection used to be three independent background utilities on the same
 * element with no ordering guarantee between them, so a selected row inside a
 * striped grid was painted by whichever rule the stylesheet happened to emit
 * last. Collapsing them onto one axis makes selection win by construction.
 */
export type TableRowState = 'default' | 'striped' | 'selected' | 'filled'

// Hover is the only chrome every row shares. It lands on `sv-bg-subtle` — the
// canvas' `#f4f4f4` well, one step below the shell's raised surface.
const TABLE_ROW_BASE = `transition-colors hover:bg-[${v('sv-bg-subtle', T.bgSubtle)}]`

// Odd rows on GROUND (`#fafafa`), one step lighter than the `#f4f4f4` that
// shipped. Striping is a reading aid, not a division: at the old tone the
// alternation was as strong as the selection tint next to it and the grid read
// as banded rather than as a list.
const TABLE_ROW_STRIPED = `bg-[${v('sv-bg', T.bg)}]`

// Selection is a NEUTRAL well, not a primary tint. `sv-primary-subtle` and
// `sv-bg-subtle` resolve to the same lightness today, so this is a rename
// rather than a repaint — and that is the point: under the old key an app that
// overrode `primary` to a saturated brand hue got its whole selected row washed
// in it, which is a chrome surface taking a colour that belongs to controls.
const TABLE_ROW_SELECTED = `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`

/**
 * Compute the default className for a body row.
 *
 * `'filled'` is base-only, and deliberately so: the row's background is the
 * author's datum (a `rowColorField` value), delivered as an inline `style`.
 * [internal ref] A7 ruling 1 gives record data the colour channel and keeps chrome out
 * of its way, so no fill utility is emitted for that state. The hover class
 * rides along harmlessly — an inline `background-color` outranks any class,
 * `:hover` included, so it is inert on a filled row rather than a repaint of
 * the author's hue.
 *
 * ## Why `computeDataTableRowClasses` next door does NOT delegate here
 * Its `'last'` state (drop the bottom rule so the shell's rounded corners
 * survive) has no counterpart here, and its base carries the cell padding and
 * type its div-simulacrum needs — because in that drawing a "row" is ONE
 * element, where here it is a `<tr>` whose padding lives on the `<td>`s. The
 * two vocabularies are disjoint, so delegating would not remove a divergence,
 * it would invent one.
 */
export const computeTableRowClasses = ({
  state = 'default',
}: {
  readonly state?: TableRowState
} = {}): string => {
  if (state === 'striped') return `${TABLE_ROW_BASE} ${TABLE_ROW_STRIPED}`
  if (state === 'selected') return `${TABLE_ROW_BASE} ${TABLE_ROW_SELECTED}`
  return TABLE_ROW_BASE
}

// ──────────────────────────────────────────────────────────────────────────────
// CELL CURSOR + FILL PREVIEW — the keyboard grid's two marked states
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the className the cell under the keyboard cursor carries.
 *
 * ## This paints something that previously painted nothing
 * The cursor has always SET its markers — `tabIndex={0}`, `aria-selected`,
 * `data-col-id` — and no rule in the compiled stylesheet answered any of them.
 * Measured live: a `<td>` carrying `aria-selected="true"` computed
 * `box-shadow: none`. The behaviour shipped without its paint, and a keyboard
 * cursor nobody can see is a navigation model the reader has to hold in their
 * head.
 *
 * An INSET ring rather than an `outline`: a `<td>` in a collapsed-border table
 * has no box of its own to outline — the ring would be drawn outside the cell
 * and clipped by its neighbours — while an inset ring paints inside the cell's
 * own paint area, the one region guaranteed to be visible.
 *
 * ## Why `inset-ring-*` and not `shadow-[inset_0_0_0_2px_…]`
 * The two compile to the same declaration; only one of them can REACH the
 * stylesheet. A composed arbitrary value is invisible to both of the
 * compiler's candidate channels: the literal source scan cannot see through
 * the `${…}` interpolation, and `arbitrary-var-safelist.ts` matches
 * `prop-[${v(…)}]` where the interpolation is the WHOLE bracket, which
 * `inset_0_0_0_2px_${v(…)}` is not. Measured before this was written: the
 * safelist contained zero entries matching `inset_0_0_0_2px`, so the composed
 * spelling would have shipped a cursor that paints nothing — reproducing the
 * exact defect this recipe exists to fix.
 *
 * `inset-ring-2` is a plain literal the source scan picks up, and
 * `inset-ring-[${v(…)}]` is the safelist's canonical shape. It composes rather
 * than collides, too: Tailwind v4 assembles `box-shadow` from separate
 * `--tw-inset-ring-shadow` and `--tw-shadow` slots, so a cursor sitting on a
 * FROZEN cell keeps both its ring and that cell's edge shadow, where two raw
 * `shadow-[…]` utilities would have overwritten each other.
 */
export const computeTableCellCursorClasses = (): string =>
  `inset-ring-2 inset-ring-[${v('sv-primary', T.primary)}]`

/**
 * Compute the className a cell inside the fill-drag preview range carries.
 *
 * The same unpainted-behaviour gap as the cursor: `data-fill-preview="true"`
 * was set and answered by nothing, so dragging the fill handle showed the
 * reader no indication of what the drag would overwrite.
 *
 * A ONE-pixel ring against the cursor's two, plus the well fill: the preview is
 * a region and the cursor is a point, and the anchor cell of a fill has to stay
 * distinguishable from the cells it is about to write. The two are mutually
 * exclusive by construction (`selectionMarkers` never marks the cursor as
 * preview), so they never compose.
 *
 * Same `inset-ring-*` spelling as the cursor, for the safelist reason recorded
 * on {@link computeTableCellCursorClasses}.
 */
export const computeTableFillPreviewClasses = (): string =>
  [
    `inset-ring-1 inset-ring-[${v('sv-primary', T.primary)}]`,
    `bg-[${v('sv-bg-subtle', T.bgSubtle)}]`,
  ].join(' ')

/**
 * Compute the default className for the fill handle — the small square on the
 * cursor cell's bottom-right corner that starts a fill drag.
 *
 * `absolute` against the cell, which is why `DataCell` adds `relative` to an
 * unpinned `<td>` that carries one (a pinned cell is already a containing block
 * through `position: sticky`).
 */
export const computeTableFillHandleClasses = (): string =>
  [
    'absolute right-0 bottom-0 z-10 h-1.5 w-1.5 cursor-crosshair',
    `bg-[${v('sv-primary', T.primary)}]`,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// FROZEN CELL — a pinned column's surface and edge shadow
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `box-shadow:4px 0 8px -4px rgba(0,0,0,0.14); position:relative;
// z-index:1; background:#fefefe` — on `th` AND `td`.
//
// The shadow is the part with no substitute: a pinned column and the columns
// sliding underneath it are the same tone, so without an edge the reader sees
// values change beside a frozen column with nothing to say why. The negative
// spread keeps it a leading edge rather than a halo.
//
// The shadow is a LITERAL rather than a `shadow-md` token spend: it is
// directional (4px on x, 0 on y) and every platform shadow is a downward drop.
// A pinned column's edge is horizontal by nature, so there is no token that
// means this.
const TABLE_FROZEN_CELL = [
  'relative z-[1]',
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  'shadow-[4px_0_8px_-4px_rgb(0_0_0_/_0.14)]',
].join(' ')

/**
 * Compute the default className for a frozen (pinned) cell's surface.
 *
 * The PIN itself — `position: sticky` and the measured `left` offset — stays
 * inline in `frozen-columns.ts`: those are computed per column from the
 * rendered header row and cannot be enumerated as classes. What moves here is
 * everything that is a design decision rather than a measurement.
 *
 * The opaque background is load-bearing rather than decorative: a `<tr>`'s
 * background is not inherited by a positioned child, so without one the columns
 * scrolling underneath read straight through the pinned values.
 */
export const computeTableFrozenCellClasses = (): string => TABLE_FROZEN_CELL

// ──────────────────────────────────────────────────────────────────────────────
// ROW NUMBER — the `showRowNumbers` ordinal
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the row-number span.
 *
 * `tabular-nums` is what keeps the ordinals in a column: proportional digits
 * make `1` narrower than `8`, so a run of row numbers wanders horizontally
 * down the left edge of the grid.
 *
 * Replaces a hard-coded `text-[var(--sv-fg-muted,oklch(0.445_0_0))]` — the
 * literal was already the right VALUE, and being written out by hand is exactly
 * how a value stops being the right one.
 */
export const computeTableRowNumberClasses = (): string =>
  `tabular-nums text-[${v('sv-fg-muted', T.fgMuted)}]`

/**
 * Compute the default className for the em-dash a cell shows when it holds
 * nothing.
 *
 * Tone ONLY — no `tabular-nums`, which the row number needs and a placeholder
 * does not. It replaces a hand-written `text-[var(--sv-fg-muted,oklch(…))]`
 * that had been copied into two cell-renderer modules and drifted between
 * them: one em-dash fell back to `oklch(0.445 0 0)` and the other to
 * `oklch(0.445 0.012 55)`, so two adjacent empty cells in the same row could
 * render in two different colours — and the chromatic one was a survivor of
 * the `--sv-warmth-*` ramp [internal ref] D5 deleted.
 */
export const computeTableEmptyValueClasses = (): string => `text-[${v('sv-fg-muted', T.fgMuted)}]`

// ──────────────────────────────────────────────────────────────────────────────
// CHECKBOX — the selection column's `<th>` / `<td>`, and every tick inside one
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for the selection column's cells.
 *
 * Canvas width 32px (`w-8`) — a checkbox column holds a 16px control and
 * nothing else, and any wider it reads as an empty first column rather than as
 * a gutter.
 *
 * ## Not yet wired on the island, by design rather than by omission
 * The selection column's `<th>` and `<td>` are rendered by the GENERIC header
 * and cell paths from a column definition, and `DataTableColumnMeta` carries no
 * class channel — so attaching this would mean adding one, which is a contract
 * change rather than a repaint. The computer ships now so the part is
 * addressable and so the SSR side can spend it; the island wiring waits for
 * whoever owns that interface.
 */
export const computeTableCheckboxCellClasses = (): string => 'w-8 px-2 align-middle'

/**
 * Compute the default className for a native checkbox `<input>` the grid draws —
 * the header's select-all, a row's selection tick, the columns menu's visibility
 * toggle, the add row's checkbox widget, and an editable cell's.
 *
 * ## Four sites drew it four ways, and two of them drew nothing
 * Measured live on one bound row: the row-selection checkbox rendered at 19x13px
 * with `accent-color: auto` — the user agent's own control, in system blue —
 * while the editor for a checkbox field, beside it in the same row, rendered at
 * 16x16 with `accent-color: oklch(0.205 0 0)`. Two controls that mean the same
 * thing and are ticked the same way, one column apart, in two sizes and two
 * hues, one of which is not a Sovrium colour at all. The columns menu had the
 * same gap.
 *
 * The two sites that WERE styled each carried the string as a literal, so a
 * fifth site was a coin flip between copying one of them and copying nothing.
 * This is the one place.
 *
 * `h-4 w-4` is the canvas' 16px control and `accent-primary` paints the ticked
 * box in the platform's own ink. Both are exactly what the two styled sites
 * shipped — a move plus two repairs, not a redraw. Nothing that was already
 * right changes.
 *
 * ## `interactive` is about the CLICK TARGET, not about being enabled
 * It adds `cursor-pointer`, which only a control the reader clicks DIRECTLY
 * needs. The columns menu's toggle sits inside a `<label>` that spans the whole
 * row and already carries the pointer, and `cursor` inherits — asking for it
 * again would be a second claim on a decision that label has made. The add
 * row's checkbox belongs to a keyboard-driven draft in the same way.
 *
 * The `<td>` AROUND a selection checkbox is
 * {@link computeTableCheckboxCellClasses} — a separate part, separately
 * unwired; see its note.
 */
export const computeTableCheckboxControlClasses = ({
  interactive = false,
}: {
  readonly interactive?: boolean
} = {}): string =>
  interactive ? 'accent-primary h-4 w-4 cursor-pointer' : 'accent-primary h-4 w-4'
