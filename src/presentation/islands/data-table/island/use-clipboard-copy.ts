/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'

/**
 * Clipboard copy behavior for the data-table island.
 *
 * Provides spreadsheet-style copy interaction:
 *
 * - **Single cell click** selects that one `<td>` cell. `Ctrl/Cmd+C` then copies
 *   the cell's value as plain text.
 * - **Shift+click** on another row extends the selection into a row range.
 *   `Ctrl/Cmd+C` copies the selected rows as TSV (tab-separated values) with a
 *   header row of field names — the format spreadsheets (Excel, Sheets) expect.
 * - On a **navigable grid** (`data-navigable`, one whose author declared an
 *   editable column), Shift+click and Shift+Arrow build a CELL RECTANGLE
 *   instead, owned by the cell cursor (`use-grid-cursor.ts`) and rendered as
 *   `td[aria-selected]`. `Ctrl/Cmd+C` there copies the rectangle as TSV, one
 *   line per row and only the columns inside it. The row range stays for
 *   every other table, where there is no cursor to extend.
 *
 * This is DOM-driven: it reads `data-field` (on `<td>`) and `data-row-id`
 * (on `<tr>`) attributes the table body already renders, so it does not need
 * to be threaded through the column/cell render pipeline.
 */

const CELL_SELECTED_ATTR = 'data-cell-selected'
const ROW_SELECTED_ATTR = 'data-row-selected'
const RANGE_CELL_SELECTOR = 'tbody > tr[data-row-id] > td[aria-selected="true"]'

/** Selection state: nothing, a single cell, a contiguous row range, or the cursor's rectangle. */
type SelectionState =
  | { readonly kind: 'none' }
  | { readonly kind: 'cell'; readonly cell: HTMLTableCellElement }
  | { readonly kind: 'rows'; readonly rows: readonly HTMLTableRowElement[] }
  | { readonly kind: 'range' }

/** Whether the cell belongs to a grid whose cursor owns Shift-selection. */
const inNavigableGrid = (cell: HTMLTableCellElement): boolean =>
  cell.closest('table')?.getAttribute('data-navigable') === 'true'

/**
 * The cursor's rectangle as TSV: the field names of its columns, then one line
 * per row. Empty when the rectangle is a single cell, which copies as text.
 */
function buildRangeTsv(container: HTMLElement): string {
  const cells = [...container.querySelectorAll<HTMLTableCellElement>(RANGE_CELL_SELECTOR)]
  if (cells.length < 2) return ''
  const rows = [...new Set(cells.map((cell) => cell.closest<HTMLTableRowElement>('tr')!))]
  const lines = rows.map((row) =>
    cells
      .filter((cell) => cell.closest('tr') === row)
      .map((cell) => (cell.textContent ?? '').trim())
      .join('\t')
  )
  const header = cells
    .filter((cell) => cell.closest('tr') === rows[0])
    .map((cell) => cell.getAttribute('data-field') ?? '')
    .join('\t')
  return [header, ...lines].join('\n')
}

/** Returns the ordered field names of a row from its `<td data-field>` cells. */
function fieldNamesOfRow(row: HTMLTableRowElement): readonly string[] {
  return [...row.querySelectorAll<HTMLTableCellElement>('td[data-field]')].map(
    (td) => td.getAttribute('data-field') ?? ''
  )
}

/** Returns the trimmed text values of a row's `<td data-field>` cells, in order. */
function valuesOfRow(row: HTMLTableRowElement): readonly string[] {
  return [...row.querySelectorAll<HTMLTableCellElement>('td[data-field]')].map((td) =>
    (td.textContent ?? '').trim()
  )
}

/** Builds a TSV string (header + data rows) from the selected `<tr>` elements. */
function buildRowsTsv(rows: readonly HTMLTableRowElement[]): string {
  if (rows.length === 0) return ''
  const header = fieldNamesOfRow(rows[0]!).join('\t')
  const dataLines = rows.map((row) => valuesOfRow(row).join('\t'))
  return [header, ...dataLines].join('\n')
}

/** Clears every cell/row selection marker inside the container. */
function clearMarkers(container: HTMLElement): void {
  container
    .querySelectorAll(`[${CELL_SELECTED_ATTR}]`)
    .forEach((el) => el.removeAttribute(CELL_SELECTED_ATTR))
  container
    .querySelectorAll(`[${ROW_SELECTED_ATTR}]`)
    .forEach((el) => el.removeAttribute(ROW_SELECTED_ATTR))
}

/** All data `<tr>` elements (those carrying a `data-row-id`) in document order. */
function dataRows(container: HTMLElement): readonly HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-row-id]')]
}

/**
 * Marks a contiguous range of rows between two `<tr>` elements as selected,
 * inclusive. Used for Shift+click range extension.
 */
function selectRowRange(
  container: HTMLElement,
  anchor: HTMLTableRowElement,
  focus: HTMLTableRowElement
): readonly HTMLTableRowElement[] {
  const rows = dataRows(container)
  const a = rows.indexOf(anchor)
  const b = rows.indexOf(focus)
  if (a === -1 || b === -1) return []
  const [start, end] = a <= b ? [a, b] : [b, a]
  const range = rows.slice(start, end + 1)
  clearMarkers(container)
  range.forEach((row) => row.setAttribute(ROW_SELECTED_ATTR, 'true'))
  return range
}

/**
 * What `Ctrl/Cmd+C` puts on the clipboard for the current selection.
 *
 * A Shift-Arrow extends the cursor's rectangle without any click, so the
 * rectangle is read from the DOM at copy time rather than tracked here; it
 * wins over the single-cell selection whenever it spans more than one cell.
 */
function selectionText(selection: SelectionState, container: HTMLElement): string {
  if (selection.kind === 'none') return ''
  if (selection.kind === 'rows') return buildRowsTsv(selection.rows)
  const rangeText = buildRangeTsv(container)
  if (rangeText !== '') return rangeText
  return selection.kind === 'cell' ? (selection.cell.textContent ?? '').trim() : ''
}

/** What a click leaves selected, and which row anchors the next Shift-click. */
interface ClickOutcome {
  readonly selection: SelectionState
  readonly anchorRow: HTMLTableRowElement | null
}

/**
 * Resolve a click: a plain click selects one cell and anchors a Shift-click
 * range; a Shift-click extends it — into rows, or on a navigable grid into
 * the cell rectangle the cursor owns. `undefined` when the click landed on
 * nothing the selection can hold.
 */
function resolveClick(
  container: HTMLElement,
  event: MouseEvent,
  anchorRow: HTMLTableRowElement | null
): ClickOutcome | undefined {
  const target = event.target as HTMLElement | null
  const cell = target?.closest<HTMLTableCellElement>('td[data-field]')
  if (!cell) return undefined
  const row = cell.closest<HTMLTableRowElement>('tr[data-row-id]')
  if (!row) return undefined

  if (event.shiftKey && inNavigableGrid(cell)) {
    // The cursor built a cell rectangle; nothing to mark here.
    clearMarkers(container)
    return { selection: { kind: 'range' }, anchorRow }
  }
  if (event.shiftKey && anchorRow) {
    const range = selectRowRange(container, anchorRow, row)
    return { selection: { kind: 'rows', rows: range }, anchorRow }
  }

  // Plain click: select this single cell and set it as the range anchor.
  clearMarkers(container)
  cell.setAttribute(CELL_SELECTED_ATTR, 'true')
  return { selection: { kind: 'cell', cell }, anchorRow: row }
}

/**
 * Wires clipboard copy interaction into the data-table.
 *
 * Returns a ref to attach to the table's container element. All listeners are
 * scoped to that container and cleaned up on unmount.
 */
export function useClipboardCopy() {
  const containerRef = useRef<HTMLDivElement>(null)
  // Selection + the row that anchors a Shift+click range. Kept in refs (not
  // state) so the keyboard handler reads the latest value without re-binding.
  const selectionRef = useRef<SelectionState>({ kind: 'none' })
  const anchorRowRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const handleClick = (event: MouseEvent): void => {
      const outcome = resolveClick(container, event, anchorRowRef.current)
      if (!outcome) return
      /* eslint-disable functional/immutable-data -- Refs track the active selection and its anchor */
      selectionRef.current = outcome.selection
      anchorRowRef.current = outcome.anchorRow
      /* eslint-enable functional/immutable-data */
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      const isCopy = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c'
      if (!isCopy) return
      const text = selectionText(selectionRef.current, container)
      if (text === '') return

      event.preventDefault()
      void navigator.clipboard.writeText(text)
    }

    container.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      container.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return containerRef
}
