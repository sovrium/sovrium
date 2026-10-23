/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flexRender } from '@tanstack/react-table'
import { Fragment } from 'react'
import { useInlineExpand } from '../../inline-expand/inline-expand-context'
import { InlineExpandToggle, InlineRecordBody } from '../../inline-expand/inline-expand-row'
import { performRowAction, type RowActionContext } from '../../row-action'
import { rowIdOf } from '../../row-identity'
import type { DataTableInstance, DataTableRow } from '../table-features'
import type { ReactNode } from 'react'

/**
 * The grid read as a list of two-line items on a phone (`phoneLayout: rows`):
 * the first field column is each item's title, the next two its second line,
 * in the cells' own formatting. Selection, row-number and action columns carry
 * no field and are left out, which is why the row stays one reading line
 * instead of a squeezed grid that scrolls sideways.
 *
 * A grid that OPENS a row (`onRowClick`) makes each item the button that opens
 * it — the same action a click on the grid's row runs, reachable by a tap and
 * by the keyboard. A grid with nowhere to open keeps plain items.
 */
export function PhoneRows({
  table,
  ariaLabel,
  onRowClickAction,
  tableName,
}: {
  readonly table: DataTableInstance
  readonly ariaLabel?: string
} & RowActionContext) {
  const fieldColumns = table
    .getVisibleLeafColumns()
    .filter((column) => column.columnDef.meta?.field !== undefined)
    .slice(0, 3)
  const rowAction: RowActionContext | undefined =
    onRowClickAction === undefined ? undefined : { onRowClickAction, tableName }
  // Rows that open their record under themselves carry its toggle.
  const expands = useInlineExpand() !== undefined
  return (
    <ul
      aria-label={ariaLabel}
      className="divide-border divide-y"
    >
      {table.getRowModel().rows.map((row) => (
        <Fragment key={row.id}>
          <li
            data-table-phone-row=""
            className={rowAction === undefined ? `${ITEM_CLASSES} relative` : 'relative'}
          >
            <PhoneRowOpener
              row={row}
              rowAction={rowAction}
            >
              <PhoneRowContent
                row={row}
                fieldColumns={fieldColumns}
              />
            </PhoneRowOpener>
            {expands && (
              <span className="absolute top-2 right-2">
                <InlineExpandToggle row={row} />
              </span>
            )}
          </li>
          <PhoneRowRecord row={row} />
        </Fragment>
      ))}
    </ul>
  )
}

type FieldColumn = ReturnType<DataTableInstance['getVisibleLeafColumns']>[number]

/** One item's two lines: the title column's value, then the next two cells. */
function PhoneRowContent({
  row,
  fieldColumns,
}: {
  readonly row: DataTableRow
  readonly fieldColumns: readonly FieldColumn[]
}) {
  const [titleColumn, ...detailColumns] = fieldColumns
  const cells = row.getVisibleCells()
  const title = titleColumn === undefined ? undefined : row.getValue(titleColumn.id)
  return (
    <>
      <span
        data-table-phone-row-title=""
        className="text-foreground truncate font-medium"
      >
        {title === undefined || title === null ? '' : String(title)}
      </span>
      <span className="text-muted-foreground flex min-w-0 flex-wrap gap-x-3 text-sm">
        {detailColumns.map((column) => {
          const cell = cells.find((candidate) => candidate.column.id === column.id)
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
    </>
  )
}

const ITEM_CLASSES = 'flex min-w-0 flex-col gap-0.5 px-3 py-2'

/** A row's open record, as the next item of the list: under its row, before the next one. */
function PhoneRowRecord({ row }: { readonly row: DataTableRow }) {
  const expand = useInlineExpand()
  if (expand === undefined || !expand.isExpanded(rowIdOf(row))) return null
  return (
    <li data-table-phone-row-record="">
      <InlineRecordBody row={row} />
    </li>
  )
}

/** The item's content, inside the button that opens its row when the grid opens rows. */
function PhoneRowOpener({
  row,
  rowAction,
  children,
}: {
  readonly row: DataTableRow
  readonly rowAction: RowActionContext | undefined
  readonly children: ReactNode
}): ReactNode {
  if (rowAction === undefined) return children
  return (
    <button
      type="button"
      data-table-phone-row-open=""
      className={`${ITEM_CLASSES} hover:bg-muted/50 focus-visible:ring-ring/50 w-full text-left outline-none focus-visible:ring-[3px]`}
      onClick={(event) => performRowAction(row, rowAction, event.currentTarget)}
    >
      {children}
    </button>
  )
}
