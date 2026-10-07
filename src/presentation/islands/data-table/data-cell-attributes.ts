/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableCellCursorClasses,
  computeTableFillPreviewClasses,
} from '@/presentation/design/table-default-classes'
import { readAiRefinementStatus } from '../runtime/ai-refinement-status'
import { columnAlignClass } from './column-align'
import { presentationAttributes, type CellPresentation } from './column-presentation'
import { FROZEN_CELL_CLASS, frozenCellStyle, type FrozenOffsets } from './frozen-columns'
import { rowIdOf } from './row-identity'
import type { CellMeta, DataRowContext } from './data-row-types'
import type { AiFieldRefinementStatus } from '../runtime/ai-refinement-status'
import type { CellRange } from './island/grid-cursor-model'
import type { DataTableCell } from './island/table-features'
import type { CSSProperties } from 'react'

/**
 * The attributes one grid `<td>` carries beyond its content: its pin
 * offset, its place in the roving cursor, its selection and range marks, its
 * AI refinement status and the class the cursor marks resolve to.
 */

// ---------------------------------------------------------------------------
// Cell
// ---------------------------------------------------------------------------

/**
 * A frozen column pins its VALUES, not just its heading: the body cell takes the
 * same sticky offset its header wears, so the column still reads as ONE column
 * after a horizontal scroll. `undefined` for every unfrozen cell.
 */
function frozenPinStyle(
  meta: CellMeta,
  frozenOffsets: FrozenOffsets | undefined
): CSSProperties | undefined {
  if (meta?.frozen !== true) return undefined
  return frozenCellStyle(frozenOffsets?.[meta.field ?? ''] ?? 0)
}

/**
 * This cell's AI refinement status, or `undefined`.
 *
 * An AI-computed value whose refinement failed or is still running is otherwise
 * byte-identical to a refined one. The status is read off the ROW's `_aiCompute`
 * block, which only ever holds entries for AI-compute fields — so every other
 * cell in the grid pays a single property lookup and nothing more.
 */
export const cellRefinementStatus = (
  cell: DataTableCell,
  meta: CellMeta
): AiFieldRefinementStatus | undefined =>
  meta?.field === undefined ? undefined : readAiRefinementStatus(cell.row.original, meta.field)

/**
 * R4: Enter / F2 open the editor from the keyboard, and must NOT also fire the
 * row action. The `target !== currentTarget` guard is what keeps an Enter
 * pressed INSIDE the open editor from re-entering edit mode.
 */
export const cellKeyDownHandler =
  (openEditor: () => void) =>
  (e: React.KeyboardEvent<HTMLTableCellElement>): void => {
    if (e.target !== e.currentTarget) return
    if (e.key !== 'Enter' && e.key !== 'F2') return
    e.preventDefault()
    e.stopPropagation()
    openEditor()
  }

/**
 * The identity a cell's row answers to — the same expression the `<tr>` writes
 * into `data-row-id`, so the cursor and the DOM cannot disagree about which
 * row a cell belongs to.
 */
export const cellRowId = (cell: DataTableCell): string => rowIdOf(cell.row)

/**
 * This cell's place in the roving tabindex, or `undefined` when the table is
 * not a grid and keeps its native focus behaviour.
 *
 * Every cell of a grid carries a tabindex: `0` for the cursor, `-1` for the
 * rest. That is what makes the whole grid ONE tab stop. Before this, every
 * editable cell carried `tabIndex: 0`, so a reader tabbing past a modest
 * twelve-by-six grid crossed seventy-odd stops to get to whatever followed it.
 *
 * `-1` rather than no attribute at all is the load-bearing half: it keeps each
 * cell focusable PROGRAMMATICALLY, which is how an arrow key moves the cursor.
 * Simply deleting the attribute would make the grid a single tab stop too, and
 * an unnavigable one.
 */
function cellTabIndex(
  navigable: boolean,
  isCursor: boolean,
  canOpenEditor: boolean
): number | undefined {
  if (navigable) return isCursor ? 0 : -1
  // Not a grid: preserve exactly what shipped before — an editable cell is
  // reachable by Tab, everything else is inert.
  return canOpenEditor ? 0 : undefined
}

/**
 * The cursor-related attributes of one `<td>`: its place in the roving
 * tabindex, whether it carries the cursor marker, and the column identity the
 * grid-level focus handler reads back.
 *
 * Assembled here rather than inline so `DataCell` stays a renderer. Returns an
 * empty object for a read-only table, which is what leaves the native `<table>`
 * semantics — and the focus behaviour that shipped before any of this — exactly
 * as they were.
 */
export function cursorCellAttributes(
  cell: DataTableCell,
  ctx: DataRowContext,
  canOpenEditor: boolean
): { readonly attrs: Record<string, unknown>; readonly isCursor: boolean } {
  const navigable = ctx.navigable === true
  if (!navigable) {
    const tabIndex = cellTabIndex(false, false, canOpenEditor)
    return { isCursor: false, attrs: tabIndex === undefined ? {} : { tabIndex } }
  }
  const rowId = cellRowId(cell)
  const columnId = cell.column.id
  const isCursor = ctx.cursorRowId === rowId && ctx.cursorColumnId === columnId
  return {
    isCursor,
    attrs: {
      'data-col-id': columnId,
      tabIndex: cellTabIndex(true, isCursor, canOpenEditor),
      ...selectionMarkers(ctx, rowId, columnId, isCursor),
    },
  }
}

const rangeHas = (range: CellRange | undefined, rowId: string, columnId: string): boolean =>
  range !== undefined && range.rowIds.has(rowId) && range.columnIds.has(columnId)

/** The range and fill-preview markers of one cell in a navigable grid. */
function selectionMarkers(
  ctx: DataRowContext,
  rowId: string,
  columnId: string,
  isCursor: boolean
): Record<string, 'true'> {
  const inRange = isCursor || rangeHas(ctx.range, rowId, columnId)
  const inFillPreview = !isCursor && rangeHas(ctx.fillPreview, rowId, columnId)
  return {
    ...(inRange && { 'aria-selected': 'true' as const }),
    ...(inFillPreview && { 'data-fill-preview': 'true' as const }),
  }
}

/** One `<td>`'s attributes beyond its content: role, class, pin, field, cursor marks. */
export function dataCellAttributes(params: {
  readonly ctx: DataRowContext
  readonly meta: CellMeta
  readonly presentation: CellPresentation
  readonly cursorAttrs: Record<string, unknown>
  readonly positioned: boolean
  readonly isCursor: boolean
}): Record<string, unknown> {
  const { ctx, meta, presentation, cursorAttrs, positioned, isCursor } = params
  const pinStyle = frozenPinStyle(meta, ctx.frozenOffsets)
  // The fill handle needs a containing block; a pinned (sticky) cell already is one.
  const positionClass = positioned && !pinStyle ? 'relative' : ''
  return {
    ...(ctx.gridRole && { role: 'gridcell' }),
    className: `${ctx.cellClass} ${ctx.borderClass} whitespace-nowrap ${columnAlignClass(meta?.align)} ${presentation.className} ${positionClass} ${pinStyle ? FROZEN_CELL_CLASS : ''} ${cellMarkerClass(cursorAttrs, isCursor)}`,
    ...presentationAttributes(presentation, pinStyle),
    ...(meta?.field && { 'data-field': meta.field }),
    ...cursorAttrs,
  }
}

/**
 * The paint for the two cell states the keyboard grid MARKS.
 *
 * Both markers shipped without one: `aria-selected` and `data-fill-preview`
 * were set on the `<td>` and no rule in the compiled stylesheet answered
 * either, so a measured cursor cell computed `box-shadow: none`. The behaviour
 * landed without its affordance, and this is where the two meet again.
 *
 * They are mutually exclusive by construction — `selectionMarkers` never marks
 * the cursor as preview — so the two rings never compose into a 3px edge.
 */
function cellMarkerClass(cursorAttrs: Record<string, unknown>, isCursor: boolean): string {
  if (isCursor) return computeTableCellCursorClasses()
  if (cursorAttrs['data-fill-preview'] === 'true') return computeTableFillPreviewClasses()
  return ''
}
