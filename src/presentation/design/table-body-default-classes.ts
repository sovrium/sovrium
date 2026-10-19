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

/**
 * The heights a grid draws its rows at: the three an author may declare
 * (`rowHeight`), and `extra-tall`, which only a reader picks — from the bottom
 * bar's Row height, for the visit — to read a long text's two lines in full.
 */
export type GridRowHeight = RowHeight | 'extra-tall'

const TABLE_CELL_HEIGHT: Readonly<Record<GridRowHeight, string>> = {
  short: 'h-9',
  medium: 'h-11',
  tall: 'h-14',
  'extra-tall': 'h-20',
}

/**
 * Compute the default className for a body cell at a given row height.
 *
 * SUPERSEDES `ROW_HEIGHT_CLASSES` for the body cell — that map now delegates
 * here, so the density control and this recipe cannot disagree.
 *
 * `h-9` / `h-11` / `h-14` / `h-20` are 36 / 44 / 56 / 80px. On a `<td>` a `height` is a
 * MINIMUM rather than a cap (CSS table sizing treats it as such), so a cell
 * whose content genuinely needs more still gets it; what the declaration buys
 * is that a row of ordinary values is always exactly its density's height
 * instead of whatever its padding happened to sum to.
 */
export const computeTableCellClasses = ({
  rowHeight,
}: {
  readonly rowHeight: GridRowHeight
}): string => `${TABLE_CELL_BASE} ${TABLE_CELL_HEIGHT[rowHeight]}`

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
 * The body sits on the card surface, the one background every part of the grid
 * shares in both modes (shadcn/ui's `Table` inherits it): the frozen cells, the
 * shell and the body are one tone, and only the row states below step off it.
 */
export const computeTableBodyClasses = (): string => 'divide-border bg-card divide-y'

// ──────────────────────────────────────────────────────────────────────────────
// ROW — `<tr>` state
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The four states a body row can be painted in.
 *
 * They are EXCLUSIVE. As three independent background utilities on the same
 * element, striping, hover and selection would have no ordering guarantee
 * between them, so a selected row inside a striped grid would be painted by
 * whichever rule the stylesheet happened to emit last. One axis makes selection
 * win by construction.
 */
export type TableRowState = 'default' | 'striped' | 'selected' | 'filled'

// The row states are base-nova's `TableRow`: hover and the selected row land on
// the `muted` well (`hover:bg-muted/50`, `data-[state=selected]:bg-muted`), so a
// brand `primary` never washes a whole row. Striping is a reading aid, a lighter
// step of the same well, and stays distinct from the hover above it.
const TABLE_ROW_BASE = 'transition-colors hover:bg-muted/50'

const TABLE_ROW_STRIPED = 'bg-muted/30'

const TABLE_ROW_SELECTED = 'bg-muted'

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
 * `inset-ring-*` rather than a composed `shadow-[inset_…]`: Tailwind v4 assembles
 * `box-shadow` from separate `--tw-inset-ring-shadow` and `--tw-shadow` slots, so
 * a cursor sitting on a FROZEN cell keeps both its ring and that cell's edge
 * shadow, where two raw `shadow-[…]` utilities would overwrite each other.
 */
export const computeTableCellCursorClasses = (): string => 'inset-ring-2 inset-ring-primary'

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
  ['inset-ring-1 inset-ring-primary', 'bg-muted'].join(' ')

/**
 * Compute the default className for the fill handle — the small square on the
 * cursor cell's bottom-right corner that starts a fill drag.
 *
 * `absolute` against the cell, which is why `DataCell` adds `relative` to an
 * unpinned `<td>` that carries one (a pinned cell is already a containing block
 * through `position: sticky`).
 */
export const computeTableFillHandleClasses = (): string =>
  ['absolute right-0 bottom-0 z-10 h-1.5 w-1.5 cursor-crosshair', 'bg-primary'].join(' ')

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
//
// The fill and the edge are worn only while the grid is SCROLLED sideways
// (`data-scrolled` on the scroll region): at rest nothing slides under the
// column, so it keeps the row's own tone — its hover, its selection, its
// `rowColorField` fill — like every other cell.
const TABLE_FROZEN_CELL = [
  'relative z-[1]',
  'in-data-[scrolled=true]:bg-card',
  'in-data-[scrolled=true]:shadow-[4px_0_8px_-4px_rgb(0_0_0_/_0.14)]',
].join(' ')

// The trailing action column, pinned to the RIGHT edge: the mirror image, worn
// only while columns are still clipped past that edge (`data-overflow-end`).
// Its row menu is the way into a row, and a menu scrolled off-screen is a row
// nobody can open.
const TABLE_TRAILING_PIN_CELL = [
  'in-data-[overflow-end=true]:bg-card',
  'in-data-[overflow-end=true]:shadow-[-4px_0_8px_-4px_rgb(0_0_0_/_0.14)]',
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

/** The surface of the trailing action column pinned to the grid's right edge. */
export const computeTableTrailingPinCellClasses = (): string => TABLE_TRAILING_PIN_CELL

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
 * Muted, like every secondary readout in the grid.
 */
export const computeTableRowNumberClasses = (): string => 'tabular-nums text-muted-foreground'

/**
 * Compute the default className for the em-dash a cell shows when it holds
 * nothing.
 *
 * Tone ONLY: no `tabular-nums`, which the row number needs and a placeholder
 * does not.
 */
export const computeTableEmptyValueClasses = (): string => 'text-muted-foreground'

/**
 * The inline text editor, laid OVER its cell rather than inside its flow: the
 * cell is its containing block, so opening the editor neither grows the row
 * nor widens the column. A primary rule says which cell is being written.
 */
export const computeTableCellEditorClasses = (): string =>
  'absolute inset-0 z-10 m-0 size-full min-w-0 rounded-sm border-2 border-primary bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

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
 * The island reaches it through the selection column's `meta.selection`
 * (`columnPlacementClass`), on both the `<th>` and the `<td>`. No right padding,
 * as base-nova's `TableHead` / `TableCell` drop it beside a checkbox.
 */
export const computeTableCheckboxCellClasses = (): string => 'w-8 pr-0 pl-2 align-middle'

/**
 * shadcn/ui's `Checkbox` box (base-nova), drawn on a native input: the
 * user agent's drawing turned off, a muted-foreground outline that holds 3:1
 * against the page while unticked, and the primary fill once ticked or partly
 * ticked. The mark is {@link computeTableCheckboxIndicatorClasses}.
 */
const TABLE_CHECKBOX_BOX =
  'peer m-0 size-4 shrink-0 appearance-none rounded-[4px] border border-muted-foreground bg-transparent outline-none transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:checked:bg-primary dark:indeterminate:bg-primary'

/**
 * The box of every checkbox the grid draws — the header's select-all, a row's
 * selection tick, the add row's checkbox widget and an editable cell's — one
 * recipe, so the four read as the same control. `interactive` adds the pointer
 * for a box the reader clicks directly.
 */
export const computeTableCheckboxControlClasses = ({
  interactive = false,
}: {
  readonly interactive?: boolean
} = {}): string => `${TABLE_CHECKBOX_BOX}${interactive ? ' cursor-pointer' : ''}`

/**
 * The mark inside a grid checkbox (`checkbox-indicator`): drawn over the box,
 * shown once the box is ticked or partly ticked, in the primary's foreground.
 */
export const computeTableCheckboxIndicatorClasses = (): string =>
  'pointer-events-none invisible absolute inset-0 grid place-content-center text-primary-foreground peer-checked:visible peer-indeterminate:visible [&>svg]:size-3.5'
