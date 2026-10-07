/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flexRender } from '@tanstack/react-table'
import type { DataTableInstance } from '../table-features'

/**
 * The grid read as a list of two-line items on a phone (`phoneLayout: rows`):
 * the first field column is each item's title, the next two its second line,
 * in the cells' own formatting. Selection, row-number and action columns carry
 * no field and are left out, which is why the row stays one reading line
 * instead of a squeezed grid that scrolls sideways.
 */
export function PhoneRows({
  table,
  ariaLabel,
}: {
  readonly table: DataTableInstance
  readonly ariaLabel?: string
}) {
  const fieldColumns = table
    .getVisibleLeafColumns()
    .filter((column) => column.columnDef.meta?.field !== undefined)
    .slice(0, 3)
  const [titleColumn, ...detailColumns] = fieldColumns
  return (
    <ul
      aria-label={ariaLabel}
      className="divide-border divide-y"
    >
      {table.getRowModel().rows.map((row) => {
        const cells = row.getVisibleCells()
        const cellOf = (columnId: string) => cells.find((cell) => cell.column.id === columnId)
        const title = titleColumn === undefined ? undefined : row.getValue(titleColumn.id)
        return (
          <li
            key={row.id}
            data-table-phone-row=""
            className="flex min-w-0 flex-col gap-0.5 px-3 py-2"
          >
            <span
              data-table-phone-row-title=""
              className="text-foreground truncate font-medium"
            >
              {title === undefined || title === null ? '' : String(title)}
            </span>
            <span className="text-foreground-muted flex min-w-0 flex-wrap gap-x-3 text-sm">
              {detailColumns.map((column) => {
                const cell = cellOf(column.id)
                return (
                  <span
                    key={column.id}
                    className="min-w-0 truncate"
                  >
                    {cell === undefined
                      ? undefined
                      : flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </span>
                )
              })}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
