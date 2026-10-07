/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { isGridNavKey, navigateFrom } from '../grid-cursor'
import {
  rowIdOf,
  resolveCursor,
  rowBelow,
  rectangleBetween,
  editingCursor,
  cursorOfCell,
} from './grid-cursor-model'
import type { GridCursor, CellLookup } from './grid-cursor-model'
import type { DataTableGridColumn, DataTableRow } from './table-features'
import type { EditingCell } from '../../hooks/use-inline-editing'
import type {
  Dispatch,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
  SetStateAction,
} from 'react'

/** Resolves a cursor to its rendered `<td>`, by the identities the grid emits. */
function useCellLookup(tableRef: RefObject<HTMLTableElement | null>): CellLookup {
  return useCallback<CellLookup>(
    (target) =>
      tableRef.current?.querySelector<HTMLTableCellElement>(
        `tbody > tr[data-row-id="${CSS.escape(target.rowId)}"] > td[data-col-id="${CSS.escape(target.columnId)}"]`
      ) ?? undefined,
    [tableRef]
  )
}

/**
 * Everything about WHERE focus is, for one grid.
 *
 * Two jobs, kept together because they share one piece of knowledge — which
 * cell this grid last put focus on — and separating them would mean handing
 * that ref around.
 *
 * **Serving a request.** The target is RECORDED when the request is made
 * rather than derived when it is served: in between, the cursor can be
 * rewritten by the focus the request itself causes, or re-resolved by a
 * re-query, and a recorded target cannot drift. Going through an effect at all
 * is what makes it possible to focus a cell whose editor is still mounted when
 * the request is made — the Enter case, where the commit and the cursor move
 * happen in one keystroke. It is served exactly ONCE: a request that kept
 * retrying would fight the very next arrow key, dragging the cursor back to
 * where the commit left it.
 *
 * **Restoring after a re-read.** The records endpoint moves a just-updated
 * row, so the grid re-renders in a new ORDER moments after an inline commit.
 * Rows are keyed by record, so React MOVES their nodes rather than rewriting
 * them — which keeps the cursor on the right record, but detaches the focused
 * `<td>` on the way and leaves the reader on `document.body`, where the next
 * arrow key scrolls the page. The guard is deliberately narrow, because a
 * focus-restoring effect is one mis-scoped condition away from stealing focus:
 * it acts only when the cell this grid last focused is no longer CONNECTED and
 * focus has fallen all the way to the body. A reader who clicks a control
 * elsewhere leaves `activeElement` on that control; a reader who merely moved
 * the cursor leaves the old cell connected. Neither is touched.
 */
function useCursorFocus(enabled: boolean, cellFor: CellLookup, resolved: GridCursor | undefined) {
  const pendingRef = useRef<GridCursor | undefined>(undefined)
  const focusedCellRef = useRef<HTMLTableCellElement | undefined>(undefined)
  const [request, setRequest] = useState(0)

  useEffect(() => {
    const target = pendingRef.current
    // The non-zero guard stops a freshly mounted grid from taking focus off
    // whatever the reader was actually doing.
    if (!enabled || request === 0 || target === undefined) return
    const cell = cellFor(target)
    cell?.focus()
    focusedCellRef.current = cell
    pendingRef.current = undefined
  }, [request, enabled, cellFor])

  // No dependency array on purpose: the render that loses focus is a re-read,
  // which changes nothing this hook could key on.
  useEffect(() => {
    const previous = focusedCellRef.current
    if (!enabled || previous === undefined || previous.isConnected) return
    if (document.activeElement !== document.body) return
    const cell = resolved === undefined ? undefined : cellFor(resolved)
    cell?.focus()
    focusedCellRef.current = cell
  })

  const requestFocus = useCallback((target: GridCursor | undefined): void => {
    pendingRef.current = target
    setRequest((n) => n + 1)
  }, [])

  const noteFocusedCell = useCallback((cell: HTMLTableCellElement): void => {
    focusedCellRef.current = cell
  }, [])

  return { requestFocus, noteFocusedCell }
}

/** The state setters the DOM handlers write through. */
interface CursorWriters {
  readonly setCursor: Dispatch<SetStateAction<GridCursor | undefined>>
  readonly setAnchor: Dispatch<SetStateAction<GridCursor | undefined>>
  readonly noteFocusedCell: (cell: HTMLTableCellElement) => void
  /** The cursor as of the latest render — where a Shift-click extends FROM. */
  readonly resolvedRef: RefObject<GridCursor | undefined>
}

/**
 * A Shift-click extends the range FROM the cursor: the anchor stays where the
 * range began (or starts at the cursor), and focus moves to the clicked cell
 * so the next Shift-Arrow extends from the same end. The default is prevented
 * so the browser does not also select the text between the two clicks. A
 * plain click drops the anchor and lets focus move natively.
 */
function useShiftClickHandler(
  enabled: boolean,
  keepOrStartAnchor: (origin: GridCursor | undefined) => void,
  setAnchor: Dispatch<SetStateAction<GridCursor | undefined>>,
  resolvedRef: RefObject<GridCursor | undefined>
) {
  return useCallback(
    (event: ReactMouseEvent<HTMLTableElement>): void => {
      if (!enabled) return
      const cell = (event.target as HTMLElement | null)?.closest<HTMLTableCellElement>(
        'td[data-col-id]'
      )
      if (!cell) return
      if (!event.shiftKey) {
        setAnchor(undefined)
        return
      }
      event.preventDefault()
      keepOrStartAnchor(resolvedRef.current ?? cursorOfCell(cell))
      cell.focus()
    },
    [enabled, keepOrStartAnchor, setAnchor, resolvedRef]
  )
}

/**
 * The three DOM listeners the grid element carries.
 *
 * All live on the `<table>` rather than on each cell: focus, keydown and
 * mousedown all bubble, so one listener per grid replaces one per cell —
 * forty-eight of them on a modest grid, each re-allocated on every render.
 *
 * A RANGE is an anchor plus the cursor. Shift keeps the anchor (establishing
 * it at the cell the gesture started from if there was none), and every plain
 * gesture drops it — so a range is only ever built deliberately, and a click
 * anywhere collapses it back to one cell, which is what a reader expects from
 * a spreadsheet.
 */
function useGridCursorHandlers(
  enabled: boolean,
  tableRef: RefObject<HTMLTableElement | null>,
  writers: CursorWriters
) {
  const { setCursor, setAnchor, noteFocusedCell, resolvedRef } = writers

  const keepOrStartAnchor = useCallback(
    (origin: GridCursor | undefined): void => {
      setAnchor((current) => current ?? origin)
    },
    [setAnchor]
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTableElement>): void => {
      if (!enabled || !isGridNavKey(event.key)) return
      // Only when the CELL ITSELF holds focus. Inside an open editor the input
      // owns its keys: an ArrowLeft there moves the text caret, and hijacking
      // it would make the editor unusable.
      const { target } = event
      if (!(target instanceof HTMLTableCellElement)) return
      const table = tableRef.current
      if (!table) return
      // Consumed even when the cursor is already at the edge the key pushes
      // against — otherwise the browser scrolls the PAGE instead, which is the
      // symptom readers report as "the arrows move the whole document".
      event.preventDefault()
      if (event.shiftKey) keepOrStartAnchor(cursorOfCell(target))
      else setAnchor(undefined)
      navigateFrom(table, target, event.key)?.focus()
    },
    [enabled, tableRef, keepOrStartAnchor, setAnchor]
  )

  const handleMouseDown = useShiftClickHandler(enabled, keepOrStartAnchor, setAnchor, resolvedRef)

  const handleFocus = useCallback(
    (event: ReactFocusEvent<HTMLTableElement>): void => {
      if (!enabled) return
      const { target } = event
      if (!(target instanceof HTMLTableCellElement)) return
      const next = cursorOfCell(target)
      if (next === undefined) return
      noteFocusedCell(target)
      // Returning the SAME object when nothing moved is load-bearing, not an
      // optimisation. React compares state by identity, so handing back a
      // fresh `{ rowId, columnId }` on every focus event re-rendered the grid,
      // which re-ran the focus effect, which re-focused the cell, which fired
      // this handler again — a loop that ended with focus somewhere the cursor
      // had never been.
      setCursor((current) =>
        current?.rowId === next.rowId && current?.columnId === next.columnId ? current : next
      )
    },
    [enabled, setCursor, noteFocusedCell]
  )

  return { handleKeyDown, handleMouseDown, handleFocus }
}

/**
 * The cell cursor for one grid: where it is, how the keyboard moves it, and
 * how an editor hands focus back to it.
 *
 * MOVEMENT reads the DOM (see `grid-cursor.ts`) because what the reader sees
 * is what an arrow key should traverse. POSITION is React state, because
 * `aria-selected` and the roving `tabindex` are rendered attributes.
 *
 * The two are joined by the focus handler rather than by bookkeeping: an arrow
 * key focuses the destination cell, that focus bubbles to the grid, and the
 * handler writes the new position. So a click and a keystroke reach the state
 * through exactly one path, and there is no way for the rendered cursor and
 * the focused cell to disagree.
 *
 * `advanceCursorRow` drops the cursor to the row below the one named and
 * focuses it — how Enter leaves a committed edit ready for the next value in
 * the same column. It clamps on the last row, so committing the bottom cell
 * keeps the cursor there rather than losing it.
 *
 * Its origin is passed in rather than read from the current cursor, which is
 * what makes the call IDEMPOTENT: "the row after row 4" is the same answer
 * however many times it is asked, where "one row down from wherever the cursor
 * is now" compounds.
 *
 * `returnFocusToCursor` is how Escape comes back from a cancelled edit without
 * the cursor moving at all.
 *
 * `range` is the rectangle between the anchor and the cursor — the cells a
 * Shift-click or a Shift-Arrow gathered — or `undefined` when the cursor
 * stands alone. It is a set of CELLS, never of rows: a reader extending down
 * one column gets that column's cells, not every cell of every row crossed,
 * which is what the row-range selection that preceded it did.
 */
export function useGridCursor(params: {
  readonly tableRef: RefObject<HTMLTableElement | null>
  /** False for a read-only table, which keeps its native focus behaviour. */
  readonly enabled: boolean
  readonly rows: readonly DataTableRow[]
  readonly leafColumns: readonly DataTableGridColumn[]
  /** The cell whose editor is open, if any — see {@link editingCursor}. */
  readonly editingCell: EditingCell | undefined
}) {
  const { tableRef, enabled, rows, leafColumns, editingCell } = params
  const [cursor, setCursor] = useState<GridCursor | undefined>(undefined)
  const [anchor, setAnchor] = useState<GridCursor | undefined>(undefined)

  const rowIds = rows.map(rowIdOf)
  const columnIds = leafColumns.map((column) => column.id)
  // A cursor the reader PLACED outranks an open editor, which outranks the
  // default first cell. Every gesture that opens an editor now moves the cursor
  // first — a click through the focus handler, Enter on the cursor itself, Tab
  // through `moveCursorTo` — so the editor only decides the cursor when nothing
  // placed one: the grid's very first double-click. It used to be the other
  // way round, and the marker then lagged a Tab by a whole round trip, sitting
  // on the cell the reader had just left until its commit came back.
  const placed = resolveCursor(cursor, rowIds, columnIds)
  const resolved =
    cursor !== undefined && placed !== undefined
      ? placed
      : (editingCursor(editingCell, leafColumns) ?? placed)
  const range =
    anchor === undefined || resolved === undefined
      ? undefined
      : rectangleBetween(anchor, resolved, rowIds, columnIds)

  const cellFor = useCellLookup(tableRef)
  const resolvedRef = useRef<GridCursor | undefined>(resolved)
  resolvedRef.current = resolved

  const { requestFocus, noteFocusedCell } = useCursorFocus(enabled, cellFor, resolved)
  const { handleKeyDown, handleMouseDown, handleFocus } = useGridCursorHandlers(enabled, tableRef, {
    setCursor,
    setAnchor,
    noteFocusedCell,
    resolvedRef,
  })

  const moves = useCursorMoves(resolved, rowIds, requestFocus, { setCursor, setAnchor })

  return {
    cursorRowId: resolved?.rowId,
    cursorColumnId: resolved?.columnId,
    // Whether the reader has PUT the cursor somewhere, as opposed to the grid
    // holding a default tab stop on its first cell. The roving tabindex needs
    // the default; an affordance hung on the cursor — the fill handle — must
    // not appear on a grid nobody has touched.
    cursorPlaced: cursor !== undefined || editingCell !== undefined,
    range,
    rowIds,
    columnIds,
    handleKeyDown,
    handleMouseDown,
    handleFocus,
    ...moves,
  }
}

/** The two programmatic cursor moves an editor hands back through. */
function useCursorMoves(
  resolved: GridCursor | undefined,
  rowIds: readonly string[],
  requestFocus: (target: GridCursor | undefined) => void,
  writers: Pick<CursorWriters, 'setCursor' | 'setAnchor'>
) {
  const { setCursor, setAnchor } = writers
  const returnFocusToCursor = useCallback((): void => {
    requestFocus(resolved)
  }, [requestFocus, resolved])

  // Puts the cursor on a cell and focuses it, collapsing any range — the
  // programmatic counterpart of a click.
  const moveCursorTo = useCallback(
    (target: GridCursor): void => {
      setAnchor(undefined)
      setCursor(target)
      requestFocus(target)
    },
    [requestFocus, setAnchor, setCursor]
  )

  const advanceCursorRow = useCallback(
    (fromRowId: string): void => {
      const columnId = resolved?.columnId
      if (columnId === undefined) return
      const from = { rowId: fromRowId, columnId }
      moveCursorTo(rowBelow(from, rowIds) ?? from)
    },
    [resolved, rowIds, moveCursorTo]
  )

  return { returnFocusToCursor, advanceCursorRow, moveCursorTo }
}
