/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DataTableGridColumn, DataTableRow } from './table-features'
import type { EditingCell } from '../../hooks/use-inline-editing'

/**
 * The grid cursor as data: where it sits, the rectangle a range spans, the
 * row below, and the cursor an edit or a cell click resolves to.
 */

/** The cell the keyboard points at, by identity rather than by index. */
export interface GridCursor {
  readonly rowId: string
  readonly columnId: string
}

/**
 * A rectangle of cells, as the product of a row set and a column set.
 *
 * A rectangle IS that product — every row in the set crossed with every column
 * in the set — so two sets describe it exactly, and membership of one cell is
 * two `has` calls rather than four index comparisons against an order the cell
 * would first have to be located in.
 */
export interface CellRange {
  readonly rowIds: ReadonlySet<string>
  readonly columnIds: ReadonlySet<string>
}

/** Finds the `<td>` for a cursor, or `undefined` if the grid no longer has one. */
export type CellLookup = (target: GridCursor) => HTMLTableCellElement | undefined

/** The row identity a `<tr data-row-id>` carries. */
export const rowIdOf = (row: DataTableRow): string => String(row.original.id ?? row.id)

/**
 * The cursor as it applies to THIS render.
 *
 * A stored cursor survives a re-render, but not necessarily a re-QUERY: a
 * sort, a filter or a page turn can retire the row it named. Rather than
 * leaving the grid with no tab stop at all, an unresolvable cursor falls back
 * to the first cell — which is also what gives a freshly loaded grid its
 * initial cursor, without an effect and without stealing focus from whatever
 * the reader was actually doing.
 */
export function resolveCursor(
  cursor: GridCursor | undefined,
  rowIds: readonly string[],
  columnIds: readonly string[]
): GridCursor | undefined {
  if (cursor && rowIds.includes(cursor.rowId) && columnIds.includes(cursor.columnId)) return cursor
  const [firstRow] = rowIds
  const [firstColumn] = columnIds
  if (firstRow === undefined || firstColumn === undefined) return undefined
  return { rowId: firstRow, columnId: firstColumn }
}

/** The same column one row further down, clamped on the last row. */
export function rowBelow(
  from: GridCursor | undefined,
  rowIds: readonly string[]
): GridCursor | undefined {
  if (from === undefined) return undefined
  const index = rowIds.indexOf(from.rowId)
  if (index < 0) return undefined
  const nextRowId = rowIds[Math.min(index + 1, rowIds.length - 1)]
  return nextRowId === undefined ? undefined : { rowId: nextRowId, columnId: from.columnId }
}

/**
 * The rectangle between two cells, or `undefined` when either has left the
 * grid — a range whose anchor was sorted off the page is no range at all,
 * and collapsing to the cursor is the only honest answer.
 */
export function rectangleBetween(
  anchor: GridCursor,
  focus: GridCursor,
  rowIds: readonly string[],
  columnIds: readonly string[]
): CellRange | undefined {
  const rowA = rowIds.indexOf(anchor.rowId)
  const rowB = rowIds.indexOf(focus.rowId)
  const colA = columnIds.indexOf(anchor.columnId)
  const colB = columnIds.indexOf(focus.columnId)
  if (rowA < 0 || rowB < 0 || colA < 0 || colB < 0) return undefined
  return {
    rowIds: new Set(rowIds.slice(Math.min(rowA, rowB), Math.max(rowA, rowB) + 1)),
    columnIds: new Set(columnIds.slice(Math.min(colA, colB), Math.max(colA, colB) + 1)),
  }
}

/**
 * The cursor implied by an open editor: the cell being edited.
 *
 * The column is looked up by FIELD rather than assumed to be the column id,
 * because the two only coincide for a plain accessor column — a generated
 * column carries a field in its meta and an id of its own.
 */
export function editingCursor(
  editingCell: EditingCell | undefined,
  leafColumns: readonly DataTableGridColumn[]
): GridCursor | undefined {
  if (editingCell === undefined) return undefined
  const column = leafColumns.find(
    (candidate) =>
      candidate.columnDef.meta?.field === editingCell.field || candidate.id === editingCell.field
  )
  return column === undefined
    ? undefined
    : { rowId: String(editingCell.rowId), columnId: column.id }
}

/** The cursor a body `<td>` stands for, or `undefined` for anything else. */
export function cursorOfCell(cell: HTMLTableCellElement): GridCursor | undefined {
  const rowId = cell.closest('tr')?.getAttribute('data-row-id') ?? undefined
  const columnId = cell.getAttribute('data-col-id') ?? undefined
  // A cell of some OTHER table, a group header, or the empty-state row —
  // none of which the cursor can sit on.
  if (rowId === undefined || columnId === undefined) return undefined
  return { rowId, columnId }
}
