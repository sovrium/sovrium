/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'


const CELL_SELECTED_ATTR = 'data-cell-selected'
const ROW_SELECTED_ATTR = 'data-row-selected'

type SelectionState =
  | { readonly kind: 'none' }
  | { readonly kind: 'cell'; readonly cell: HTMLTableCellElement }
  | { readonly kind: 'rows'; readonly rows: readonly HTMLTableRowElement[] }

function fieldNamesOfRow(row: HTMLTableRowElement): readonly string[] {
  return [...row.querySelectorAll<HTMLTableCellElement>('td[data-field]')].map(
    (td) => td.getAttribute('data-field') ?? ''
  )
}

function valuesOfRow(row: HTMLTableRowElement): readonly string[] {
  return [...row.querySelectorAll<HTMLTableCellElement>('td[data-field]')].map((td) =>
    (td.textContent ?? '').trim()
  )
}

function buildRowsTsv(rows: readonly HTMLTableRowElement[]): string {
  if (rows.length === 0) return ''
  const header = fieldNamesOfRow(rows[0]!).join('\t')
  const dataLines = rows.map((row) => valuesOfRow(row).join('\t'))
  return [header, ...dataLines].join('\n')
}

function clearMarkers(container: HTMLElement): void {
  container
    .querySelectorAll(`[${CELL_SELECTED_ATTR}]`)
    .forEach((el) => el.removeAttribute(CELL_SELECTED_ATTR))
  container
    .querySelectorAll(`[${ROW_SELECTED_ATTR}]`)
    .forEach((el) => el.removeAttribute(ROW_SELECTED_ATTR))
}

function dataRows(container: HTMLElement): readonly HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-row-id]')]
}

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

export function useClipboardCopy() {
  const containerRef = useRef<HTMLDivElement>(null)
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
        selectionRef.current = { kind: 'rows', rows: range }
        return
      }

      clearMarkers(container)
      cell.setAttribute(CELL_SELECTED_ATTR, 'true')
      anchorRowRef.current = row
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
