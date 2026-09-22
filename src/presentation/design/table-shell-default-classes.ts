/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The grid's FRAME and its head — the surface the table sits in, the `<table>`
 * itself, `<thead>` and its `<th>`, and the two affordances that live inside a
 * header cell (the sort glyph and the resize handle).
 *
 * The seam is the element, not the line count: everything here is drawn once
 * per grid and never per row, which is why the density map the body cells read
 * is deliberately absent. A header cell that tracked `rowHeight` was one of the
 * defects this recipe family was written to end — the header is chrome, and
 * chrome does not change size because the records under it did.
 *
 * Imported by both sides of the SSR/island seam, like every module in this
 * family; `table-default-classes.ts` republishes it so a caller still reaches
 * the grid's whole vocabulary from one import.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'
import { TABLE_HEADER_TYPE } from '@/presentation/design/table-type-classes'
import type { RowHeight } from '@/domain/models/app/pages/components/component-types/data/table/schema'

// ──────────────────────────────────────────────────────────────────────────────
// SHELL — the bordered surface the grid sits in
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `border:1px solid #e3e3e3; border-radius:6px; background:#fefefe;
// overflow:hidden; width:100%`.
//
// `bg-raised`, NOT `bg`. The canvas frame is `#fefefe` on a `#fafafa` page, so
// the grid is a surface LIFTED off the ground rather than a region of it. The
// SSR recipe this supersedes said `sv-bg`, which painted the frame at exactly
// the page's own tone and left the border doing all the work of separating
// them — the thing a raised surface exists not to need.
//
// `overflow-hidden` is load-bearing rather than tidy: the rows paint a flat
// `border-b` separator, and without the clip the last row's rule bleeds past
// the rounded corners.
const TABLE_SHELL = [
  'overflow-hidden',
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for the grid's outer surface — the element
 * carrying `data-component="data-table"`, which IS the styled frame (the
 * hydrated view renders chrome-less into it).
 *
 * Chrome only. WIDTH stays with the caller: it is a placement concern owned by
 * whatever composes the page.
 */
export const computeTableShellClasses = (): string => TABLE_SHELL

// ──────────────────────────────────────────────────────────────────────────────
// TABLE ELEMENT — the `<table>` itself
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `border-collapse:collapse; width:100%; table-layout:fixed`.
//
// `border-collapse` is what makes a cell's `border-b` meet its neighbour's
// instead of doubling into a 2px rule at every column seam. It is the whole of
// what this part adds — `min-w-full` is what already shipped, and it stays.
const TABLE_ELEMENT = 'min-w-full border-collapse'

/**
 * Compute the default className for the `<table>` element.
 *
 * ## `table-fixed` is deliberately ABSENT, against the canvas — measured
 * Fixed layout sizes the columns from the first row and ignores content width,
 * so a `table-fixed w-full` grid can never be wider than its container. This
 * grid needs it to be: `frozen-columns.ts` MEASURES each pinned column's
 * sticky `left` off the rendered header row precisely because "a column is as
 * wide as its content makes it", and the pin contract is asserted against the
 * horizontal scroll that only exists while the table can outgrow its
 * `overflow-x-auto` parent.
 *
 * That is a measurement, not an inference. Shipped as the canvas draws it, the
 * three frozen-column specs failed with their own guard —
 * `the grid never overflowed its scroll box — with nothing to scroll these
 * assertions would be vacuous` — and the remaining 260 stayed green. So the
 * divergence is one class wide and it is the specs that chose it.
 *
 * `min-w-full` rather than the canvas' `width:100%` for the same reason: it
 * fills a narrow container and grows past a full one, where `w-full` pins the
 * table to the container in both directions.
 *
 * A grid whose columns all carried declared widths could take the canvas
 * value. This one does not.
 */
export const computeTableElementClasses = (): string => TABLE_ELEMENT

// ──────────────────────────────────────────────────────────────────────────────
// HEADER ROW — `<thead>`
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the default className for `<thead>` — deliberately EMPTY.
 *
 * The header carries no background fill. Its separation from the body is the
 * header cell's own bottom rule, which is drawn in `sv-border-strong` against
 * the body's `sv-border` and is a stronger signal than a tint at a fraction of
 * the ink. `<thead>` shipped as `bg-background-subtle`, which put a filled band
 * across the top of a surface whose whole point is to be read as one plane.
 *
 * Exported as an empty-string computer anyway, rather than dropped: the part
 * has to stay addressable from `design.components.table.parts.headerRow` so an
 * author who WANTS the band can put one back.
 */
export const computeTableHeaderRowClasses = (): string => ''

// ──────────────────────────────────────────────────────────────────────────────
// FILLING A BOUNDED PARENT — the three parts `layout: fill` re-dresses
// ──────────────────────────────────────────────────────────────────────────────

// THE FLOOR, and why it is written in the grid's own rhythm
//
// `fill` hands the grid its bounded parent's LEFTOVER height, and a waived
// minimum is what lets it take one: a flex item's automatic minimum is its
// content, so a grow factor alone resolves back to the row stack's height and
// the parent scrolls after all. That is right while there IS leftover height.
// It is a cliff when there is none — the grid's fixed siblings keep the
// automatic minimum the grid gave up, so once they sum past the column the
// entire shortfall comes out of the one child that agreed to shrink without
// limit, and the grid resolves not to a small grid but to no grid.
//
// So the minimum is REPLACED rather than waived. An explicit `min-height`
// overrides `auto` exactly as `min-h-0` did — the grid still shrinks out of a
// crowded column — but it stops at a height a reader can still use.
//
// Three numbers, and each is a length the grid actually draws:
//
//   `2 * var(--sv-density-row-y)` — the header cell's own vertical padding,
//   which an authored `design.density` moves (`table-shell-default-classes`'s
//   `py-(--sv-density-row-y)` below). The `5px` fallback is the platform
//   default: a `calc()` naming an undeclared variable is invalid as a WHOLE,
//   and an invalid `min-height` falls back to `auto`, which is zero on a box
//   that clips — the very collapse this floor exists to end.
//
//   `1.5rem` — the header label's line box, taken GENEROUSLY. It is drawn at
//   `text-xs` (`TABLE_HEADER_TYPE`), which lands near 16.5px with its rule, and
//   CSS has no way to ask a pinned section how tall it drew. The slack is spent
//   in the one direction that is safe.
//
//   `3 * <row>` — three data rows at this grid's `rowHeight`, the same
//   `h-9` / `h-11` / `h-14` the body cells take (36 / 44 / 56px,
//   `table-body-default-classes.ts`). THREE because the header is drawn inside
//   this box and pinned to it, so it permanently spends part of it: a floor of
//   one row buys a reader chrome and a sliver, where three leave a row above
//   and below the one being acted on.
//
// A pixel constant would be three rows at one density and one and a half at
// another, so the floor is stated per `rowHeight` rather than once. The strings
// are spelled out per density rather than composed, because the Tailwind
// candidate corpus is harvested from source TEXT: a class assembled at runtime
// is a class the engine never emits.
const TABLE_FILL_SCROLL_FLOOR: Readonly<Record<RowHeight, string>> = {
  short: 'min-h-[calc(2*var(--sv-density-row-y,5px)_+_1.5rem_+_3*2.25rem)]',
  medium: 'min-h-[calc(2*var(--sv-density-row-y,5px)_+_1.5rem_+_3*2.75rem)]',
  tall: 'min-h-[calc(2*var(--sv-density-row-y,5px)_+_1.5rem_+_3*3.5rem)]',
}

// The FRAME's floor is the scroll region's plus ONE bar — the toolbar, as
// `var(--sv-density-control-h) + 0.75rem`: a control row plus its padding and
// its rule, 48 against a drawn 45 at the default density.
//
// It has to be larger than the scroll region's by at least that much, because
// the frame CLIPS (`TABLE_SHELL`'s `overflow-hidden`, load-bearing for the
// rounded corners) and the toolbar is drawn INSIDE it, above the rows: a frame
// floored at the scroll region's own number gives the toolbar its 45 and clips
// the bottom 45 off a scroll box whose whole purpose was to be three rows tall.
// The toolbar is also drawn for every bound grid rather than only a configured
// one, so this is a cost the frame always pays.
//
// THE PAGER IS DELIBERATELY NOT COVERED, and the reason is a measurement rather
// than a preference. An earlier spelling allowed for it too (`+ 2.5rem`, its
// `px-2 py-1.5` around an `h-6` select). On the operator console's run-history
// page at 1440x600 that pushed the grid's frame to 256 where its tab panel had
// 189 to give — and that grid draws NO pager, so the whole allowance was spent
// on chrome that was never going to appear. The panel then over-subscribed, the
// console's content column started scrolling, and two green console specs went
// red. A floor is meant to bind where a grid would otherwise COLLAPSE; a floor
// that reshapes a layout which is merely tight has stopped being a floor. So
// the rows and the controls above them are what it buys, and a pager beneath
// three rows in an over-subscribed column is clipped.
//
// The allowance is an allowance rather than a measurement because CSS cannot
// ask a sibling how tall it drew. `min-height: min-content` looks like the way
// to stop guessing and is not: measured in Chromium, a scroll container's
// min-content height is its FULL content, so a frame sized that way takes its
// natural height again and undoes `fill` entirely. The known limit of the guess
// is the toolbar's `flex-wrap` — a grid narrow enough to wrap its controls onto
// a second row spends more than the allowance, and the extra comes off the
// bottom of the scroll box.
const TABLE_FILL_VIEW_FLOOR: Readonly<Record<RowHeight, string>> = {
  short:
    'min-h-[calc(2*var(--sv-density-row-y,5px)_+_1.5rem_+_3*2.25rem_+_var(--sv-density-control-h,36px)_+_0.75rem)]',
  medium:
    'min-h-[calc(2*var(--sv-density-row-y,5px)_+_1.5rem_+_3*2.75rem_+_var(--sv-density-control-h,36px)_+_0.75rem)]',
  tall: 'min-h-[calc(2*var(--sv-density-row-y,5px)_+_1.5rem_+_3*3.5rem_+_var(--sv-density-control-h,36px)_+_0.75rem)]',
}

// The OUTER link of the chain carries the same floor plus `2px`, and that is
// the frame's own rule rather than a rounding allowance.
//
// Only one of the two links draws it. The outer surface is the bordered frame;
// the view hydration renders into it is chrome-less, by design (see
// `data-table-view.tsx`). Under the preflight's `box-sizing: border-box` a
// `min-height` is a BORDER-box height, so a frame floored at the view's own
// number leaves the view 2px less to lay its parts out in — and the view, whose
// floor says otherwise, overhangs by exactly that and has its last 2px clipped.
// Measured: the pager came out 1px past the frame's outer edge, losing the
// bottom of its own padding, on arithmetic that was otherwise exact.
const TABLE_FILL_FRAME_FLOOR: Readonly<Record<RowHeight, string>> = {
  short:
    'min-h-[calc(2*var(--sv-density-row-y,5px)_+_1.5rem_+_3*2.25rem_+_var(--sv-density-control-h,36px)_+_0.75rem_+_2px)]',
  medium:
    'min-h-[calc(2*var(--sv-density-row-y,5px)_+_1.5rem_+_3*2.75rem_+_var(--sv-density-control-h,36px)_+_0.75rem_+_2px)]',
  tall: 'min-h-[calc(2*var(--sv-density-row-y,5px)_+_1.5rem_+_3*3.5rem_+_var(--sv-density-control-h,36px)_+_0.75rem_+_2px)]',
}

/**
 * Resolve the row height a fill floor is written in.
 *
 * Tolerant on purpose: the value reaches these recipes from an author's config
 * on the server and from a JSON prop bag on the client, where it is typed as a
 * plain string, and an unrecognised density must still draw a floor rather than
 * none.
 */
const resolveRowHeight = (rowHeight: string | undefined): RowHeight =>
  rowHeight === 'short' || rowHeight === 'tall' ? rowHeight : 'medium'

// Canvas, the frame half: `flex:1; min-height:<floor>; display:flex;
// flex-direction:column; overflow:hidden`.
//
// The three declarations are one idea and cannot be separated. Growing into the
// parent's leftover height WITHOUT a minimum lets the flex algorithm size the
// box to its content instead, so the element reports the very height it was
// asked to stop having and the parent scrolls after all. Becoming a column in
// turn is what lets the part below claim that leftover: a block child of this
// frame takes its natural height and hands the scroll to nobody.
//
// The frame's own clip comes from the shell recipe above, which already hides
// its overflow; this part deliberately does not repeat it.
const tableFillShell = (rowHeight: RowHeight, framed: boolean): string =>
  `flex ${(framed ? TABLE_FILL_FRAME_FLOOR : TABLE_FILL_VIEW_FLOOR)[rowHeight]} flex-1 flex-col`

/**
 * Compute the extra className a grid takes on under `layout: fill` — on the
 * outer surface AND on the hydrated view rendered into it, which must both
 * become the same kind of box, or the chain from the bounded ancestor down to
 * the rows breaks at whichever link kept its natural height.
 *
 * `rowHeight` is what the floor is written in, so the two links of the chain
 * that clip stop at the same height the one that scrolls does.
 *
 * `framed` says which of the two links this is: the outer surface draws the
 * grid's rule and the view rendered into it does not, and a border-box
 * `min-height` has to carry the border it will be measured with.
 *
 * Nothing is added under `layout: flow`, which is the default: a grid that
 * declares no layout renders exactly the classes it always did.
 */
export const computeTableFillShellClasses = ({
  rowHeight,
  framed = false,
}: {
  readonly rowHeight: string | undefined
  readonly framed?: boolean
}): string => tableFillShell(resolveRowHeight(rowHeight), framed)

// Canvas, the scroll half: `flex:1; min-height:<floor>; overflow:auto`.
//
// This is the part that ends up OWNING the scroll, and the pairing with the
// floor is the whole of why: a grow factor with an automatic minimum resolves
// back to the content height and overflows nothing.
const tableFillScroll = (rowHeight: RowHeight): string =>
  `${TABLE_FILL_SCROLL_FLOOR[rowHeight]} flex-1 overflow-y-auto`

/**
 * Compute the extra className the grid's scroll region takes on under
 * `layout: fill` — the element that already owns the horizontal overflow, which
 * takes the vertical one as well so that ONE box moves in both directions and
 * the column labels travel sideways with the values they name.
 *
 * This is the box the floor is ABOUT: the one the header is pinned to and the
 * rows move inside, so its minimum is the header plus three rows exactly.
 */
export const computeTableFillScrollClasses = ({
  rowHeight,
}: {
  readonly rowHeight: string | undefined
}): string => tableFillScroll(resolveRowHeight(rowHeight))

// Canvas: `position:sticky; top:0; z-index:1; background;
// box-shadow: inset 0 -1px 0 <border>`.
//
// The pin lives on the whole `<thead>` and not on its cells because the section
// is what has to stay: pinned cells leave the section box behind at its
// laid-out position, so anything that measures the header — a reader's eye
// included, once a cell picks up a transform — reads a place the paint is not.
//
// The bottom rule is a SHADOW rather than the header cell's own bottom border,
// and that is a fact about collapsed borders rather than a preference: under
// `border-collapse` a cell's border belongs to the TABLE's painting rather than
// to the cell, so it does not travel with a pinned section, and the header then
// arrives over the rows with nothing under it. An inset spelling draws the rule
// inside the pinned box, where it does travel. Flat low-alpha black rather than
// a token spend, for the reason the pinned column's edge is one too: a
// one-pixel seam under a header reads on a light and a dark surface alike, and
// no elevation token means a hairline.
const TABLE_STICKY_HEADER = [
  'sticky top-0 z-10',
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  'shadow-[inset_0_-1px_0_rgb(0_0_0_/_0.12)]',
].join(' ')

/**
 * Compute the extra className `<thead>` takes on under `layout: fill`.
 *
 * The opaque fill is load-bearing rather than decorative, exactly as the pinned
 * column's is: a pinned section paints over rows that keep moving underneath
 * it, and without a fill the reader watches values slide through the labels.
 */
export const computeTableStickyHeaderClasses = (): string => TABLE_STICKY_HEADER

// ──────────────────────────────────────────────────────────────────────────────
// HEADER CELL — `<th>`
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `padding:5px 8px; font-size:11px; font-weight:500; color:#565656;
// border-bottom:1px solid #d3d3d3; text-align:left; white-space:nowrap;
// overflow:hidden; text-overflow:ellipsis`.
//
// The padding is FIXED and does NOT follow `rowHeight`. That decoupling is the
// reason this part exists: the header used to interpolate the BODY's density
// map, so switching a grid to `tall` grew the column labels' padding to 16px
// alongside the data — turning a density control for the ROWS into one that
// also inflated the chrome above them. A header is chrome; its size is a
// constant of the design, not of how much air the reader wants around values.
//
// `py-(--sv-density-row-y)` rather than a `5px` literal: the token's default IS
// 5px, so nothing moves, but an authored `design.density` now reaches it.
const TABLE_HEADER_CELL = [
  'px-2 py-(--sv-density-row-y)',
  TABLE_HEADER_TYPE,
  'text-left',
  'border-b',
  `border-[${v('sv-border-strong', T.borderStrong)}]`,
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
  'overflow-hidden text-ellipsis whitespace-nowrap',
].join(' ')

/**
 * Compute the default className for a header cell.
 *
 * The sort affordance (`cursor-pointer select-none`) and the `relative` a
 * resize handle needs for its containing block are appended by the caller —
 * both are conditional on the column, not on the design.
 */
export const computeTableHeaderCellClasses = (): string => TABLE_HEADER_CELL

// ──────────────────────────────────────────────────────────────────────────────
// SORT GLYPH — the ↑ / ↓ inside a sorted header
// ──────────────────────────────────────────────────────────────────────────────

const TABLE_SORT_GLYPH = 'ml-1 inline-flex items-center'

/**
 * Compute the default className for the sort-direction indicator.
 *
 * The glyph is drawn only while a sort is active, so `active: false` reaches
 * this computer from nothing the grid currently renders — it exists so a
 * caller that DOES draw an inactive affordance (a hover hint, say) has the
 * disabled tone to hand rather than minting one.
 *
 * The `sort-asc` / `sort-desc` class tokens and both `aria-label`s stay on the
 * element: spec locators resolve the indicator by class, and the labels are
 * what keep a sorted column announced while `aria-hidden` holds the
 * columnheader's accessible name stable.
 */
export const computeTableSortGlyphClasses = ({ active }: { readonly active: boolean }): string =>
  [
    TABLE_SORT_GLYPH,
    active ? `text-[${v('sv-fg', T.fg)}]` : `text-[${v('sv-fg-disabled', T.fgDisabled)}]`,
  ].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// RESIZE HANDLE — the column-width drag affordance
// ──────────────────────────────────────────────────────────────────────────────

// Retoned, not redrawn. The behaviour is unchanged: a hit area on the header's
// right edge, invisible until hover.
//
// `w-1` (4px) down from `w-1.5` (6px) — the canvas does not draw this control
// at all, and a resize grip should read as a hairline affordance rather than as
// a second, thicker column rule sitting beside the real one. 4px is still wide
// enough for Playwright's `hover()` actionability check, which a zero-area
// element fails.
//
// `opacity-0` down from `opacity-50`: at rest the handle is absent rather than
// half-drawn. A permanently visible 50% grip on every resizable column adds one
// vertical line per column to a surface already ruled by its own borders.
const TABLE_RESIZE_HANDLE = [
  'resize-handle absolute top-0 right-0 h-full w-1',
  'cursor-col-resize touch-none select-none',
  'opacity-0 hover:opacity-100',
  `bg-[${v('sv-border-strong', T.borderStrong)}]`,
  `hover:bg-[${v('sv-primary', T.primary)}]`,
].join(' ')

/**
 * Compute the default className for a column's resize handle.
 *
 * Includes the `resize-handle` class token itself, because spec locators
 * resolve it as `.resize-handle, [data-resize-handle]` and the class half of
 * that pair is a contract rather than styling.
 */
export const computeTableResizeHandleClasses = (): string => TABLE_RESIZE_HANDLE
