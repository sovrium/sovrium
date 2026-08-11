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
 *
 * This is DOM-driven: it reads `data-field` (on `<td>`) and `data-row-id`
 * (on `<tr>`) attributes the table body already renders, so it does not need
 * to be threaded through the column/cell render pipeline.
 */

const CELL_SELECTED_ATTR = 'data-cell-selected'
const ROW_SELECTED_ATTR = 'data-row-selected'

/** Selection state: either nothing, a single cell, or a contiguous row range. */
type SelectionState =
  | { readonly kind: 'none' }
  | { readonly kind: 'cell'; readonly cell: HTMLTableCellElement }
  | { readonly kind: 'rows'; readonly rows: readonly HTMLTableRowElement[] }

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
      const target = event.target as HTMLElement | null
      const cell = target?.closest<HTMLTableCellElement>('td[data-field]')
      if (!cell) return
      const row = cell.closest<HTMLTableRowElement>('tr[data-row-id]')
      if (!row) return

      if (event.shiftKey && anchorRowRef.current) {
        const range = selectRowRange(container, anchorRowRef.current, row)
        // eslint-disable-next-line functional/immutable-data -- Ref tracks the active selection
        selectionRef.current = { kind: 'rows', rows: range }
        return
      }

      // Plain click: select this single cell and set it as the range anchor.
      clearMarkers(container)
      cell.setAttribute(CELL_SELECTED_ATTR, 'true')
      // eslint-disable-next-line functional/immutable-data -- Ref anchors the Shift+click range
      anchorRowRef.current = row
      // eslint-disable-next-line functional/immutable-data -- Ref tracks the active selection
      selectionRef.current = { kind: 'cell', cell }
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      const isCopy = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c'
      if (!isCopy) return
      const selection = selectionRef.current
      if (selection.kind === 'none') return

      const text =
        selection.kind === 'cell'
          ? (selection.cell.textContent ?? '').trim()
          : buildRowsTsv(selection.rows)
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
