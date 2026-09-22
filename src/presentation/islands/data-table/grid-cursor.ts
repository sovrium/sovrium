/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The grid's cell CURSOR: which single cell the keyboard is pointing at.
 *
 * This is a different axis from row SELECTION, which already exists and rides
 * on `<tr aria-selected>`. A row is selected because the reader ticked it and
 * wants to act on it; a cell is the cursor because it is where the next
 * keystroke lands. A grid needs both at once — reading down a column while
 * three unrelated rows stay ticked — so they cannot share a marker.
 *
 * The cursor is identified by `(rowId, columnId)` rather than by a pair of
 * numbers. Indices are only meaningful against one particular render: a sort,
 * a filter, a page turn or an arriving realtime change all renumber the rows
 * underneath a stored index, and the cursor would silently point at a
 * different record. An id pair either still resolves after the grid moves, or
 * resolves to nothing and falls back to the default — never to the wrong cell.
 *
 * MOVEMENT, by contrast, is resolved against the DOM at keypress time rather
 * than against React state. What the reader sees is what the arrow key should
 * traverse, and only the DOM knows the order columns ended up in after
 * reordering, hiding and freezing have all had their say.
 */

/** The keys the grid answers by moving its cursor. */
export const GRID_NAV_KEYS = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
] as const

export type GridNavKey = (typeof GRID_NAV_KEYS)[number]

/** Whether a keyboard event names a cursor move. */
export const isGridNavKey = (key: string): key is GridNavKey =>
  (GRID_NAV_KEYS as readonly string[]).includes(key)

/**
 * How many rows PageUp / PageDown travel.
 *
 * A fixed step rather than a measured viewport height. Measuring would be more
 * faithful to the name, but it makes the distance depend on the window, the
 * row-height setting and whether a toolbar happens to be open — so the same
 * keystroke moves a different distance on two screens, and no test can pin it.
 * A fixed step is predictable, and predictability is what a reader paging
 * through records actually wants from the key.
 */
export const PAGE_STEP_ROWS = 10

/** Where a cell sits in the rendered body, in rows and columns. */
export interface CellPosition {
  readonly row: number
  readonly col: number
}

/** The extent of the rendered body. */
export interface GridBounds {
  readonly rowCount: number
  readonly colCount: number
}

const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), max)

/**
 * Where a navigation key takes the cursor — CLAMPED at every edge, never
 * wrapped.
 *
 * Wrapping was rejected rather than overlooked. In a long grid, an ArrowUp
 * that jumps from the first row to the last strands the reader hundreds of
 * rows from where they were, with no gesture that undoes it; and an ArrowLeft
 * that wraps to the previous row's last column silently changes RECORD while
 * the reader believes they are still moving within one. Stopping at the edge
 * is also how a reader discovers the edge.
 */
export function nextCellPosition(
  key: GridNavKey,
  from: CellPosition,
  bounds: GridBounds
): CellPosition {
  const lastRow = bounds.rowCount - 1
  const lastCol = bounds.colCount - 1
  switch (key) {
    case 'ArrowUp':
      return { row: clamp(from.row - 1, lastRow), col: from.col }
    case 'ArrowDown':
      return { row: clamp(from.row + 1, lastRow), col: from.col }
    case 'ArrowLeft':
      return { row: from.row, col: clamp(from.col - 1, lastCol) }
    case 'ArrowRight':
      return { row: from.row, col: clamp(from.col + 1, lastCol) }
    // Home and End stay on the SAME row. That is what separates them from
    // "go to the start / end of the grid": a reader using them is reading
    // across one record, not jumping to another.
    case 'Home':
      return { row: from.row, col: 0 }
    case 'End':
      return { row: from.row, col: clamp(lastCol, lastCol) }
    case 'PageUp':
      return { row: clamp(from.row - PAGE_STEP_ROWS, lastRow), col: from.col }
    case 'PageDown':
      return { row: clamp(from.row + PAGE_STEP_ROWS, lastRow), col: from.col }
  }
}

// ---------------------------------------------------------------------------
// Reading the rendered grid
// ---------------------------------------------------------------------------

/**
 * The body rows, in render order.
 *
 * Keyed on `data-row-id` so group headers, the loading skeleton, the empty
 * state and the summary footer are all excluded by construction rather than by
 * a list of things to skip — only a real record row carries one.
 */
export const gridBodyRows = (table: HTMLTableElement): readonly HTMLTableRowElement[] =>
  Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody > tr[data-row-id]'))

/** One row's cells, in render order. `:scope >` keeps a nested table's cells out. */
export const gridRowCells = (row: HTMLTableRowElement): readonly HTMLTableCellElement[] =>
  Array.from(row.querySelectorAll<HTMLTableCellElement>(':scope > td'))

/** Where a given cell sits, or `undefined` if it is not a body cell of this grid. */
export function locateCell(
  table: HTMLTableElement,
  cell: HTMLTableCellElement
): CellPosition | undefined {
  const rows = gridBodyRows(table)
  const row = rows.findIndex((candidate) => candidate.contains(cell))
  if (row < 0) return undefined
  const col = gridRowCells(rows[row]!).indexOf(cell)
  return col < 0 ? undefined : { row, col }
}

/** The cell at a position, or `undefined` when the grid is smaller than that. */
export function cellAt(
  table: HTMLTableElement,
  position: CellPosition
): HTMLTableCellElement | undefined {
  const row = gridBodyRows(table)[position.row]
  return row === undefined ? undefined : gridRowCells(row)[position.col]
}

/** The extent of the rendered body, measured from its first row. */
export function gridBounds(table: HTMLTableElement): GridBounds {
  const rows = gridBodyRows(table)
  const first = rows[0]
  return {
    rowCount: rows.length,
    colCount: first === undefined ? 0 : gridRowCells(first).length,
  }
}

/**
 * The cell a navigation key moves to, resolved entirely from the DOM.
 *
 * Returns `undefined` when the move is impossible — an unlocatable origin, or
 * an empty grid — and returns the ORIGIN cell when the cursor is already at
 * the edge the key pushes against. The caller can therefore treat "no cell" as
 * "do nothing" and still consume the key, which is what stops the browser
 * scrolling the page underneath a cursor that did not move.
 */
export function navigateFrom(
  table: HTMLTableElement,
  origin: HTMLTableCellElement,
  key: GridNavKey
): HTMLTableCellElement | undefined {
  const from = locateCell(table, origin)
  if (from === undefined) return undefined
  return cellAt(table, nextCellPosition(key, from, gridBounds(table)))
}
