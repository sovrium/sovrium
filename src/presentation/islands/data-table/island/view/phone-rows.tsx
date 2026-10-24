/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flexRender } from '@tanstack/react-table'
import { Fragment, useId } from 'react'
import { AddRow } from '../../add-row'
import { useInlineExpand } from '../../inline-expand/inline-expand-context'
import { InlineExpandToggle, InlineRecordBody } from '../../inline-expand/inline-expand-row'
import { performRowAction, type RowActionContext } from '../../row-action'
import { rowIdOf } from '../../row-identity'
import { columnLabelResolver, resolveAddRow } from '../table-add-row-columns'
import type { TableContentProps } from '../table-content-types'
import type { DataTableInstance, DataTableRow } from '../table-features'
import type { ReactNode } from 'react'

/**
 * The grid read as a list of two-line items on a phone (`phoneLayout: rows`):
 * the first field column is each item's title, the next two its second line,
 * in the cells' own formatting. Selection, row-number and action columns carry
 * no field and are left out, which is why the row stays one reading line
 * instead of a squeezed grid that scrolls sideways.
 *
 * A grid that OPENS a row (`onRowClick`) lays a button over each item that
 * opens it — the same action a click on the grid's row runs, reachable by a tap
 * and by the keyboard, and named by the item's text. The button holds no
 * content of its own: a cell drawn as a link (a file, a URL) is never nested
 * inside it, which HTML forbids, and stays clickable above it. A grid with
 * nowhere to open keeps plain items.
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
            className={`${ITEM_CLASSES} relative`}
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
  // The title is drawn by its column's cell, as the details are: a file reads
  // as its link and an option as its label, never as the stored value.
  return (
    <>
      <span
        data-table-phone-row-title=""
        className="text-foreground truncate font-medium"
      >
        {titleColumn === undefined ? undefined : renderColumnCell(cells, titleColumn)}
      </span>
      <span className="text-muted-foreground flex min-w-0 flex-wrap gap-x-3 text-sm">
        {detailColumns.map((column) => (
          <span
            key={column.id}
            className="min-w-0 truncate"
          >
            {renderColumnCell(cells, column)}
          </span>
        ))}
      </span>
    </>
  )
}

/** A column's cell of this row, in the cell's own formatting. */
function renderColumnCell(
  cells: ReturnType<DataTableRow['getVisibleCells']>,
  column: FieldColumn
): ReactNode {
  const cell = cells.find((candidate) => candidate.column.id === column.id)
  return cell === undefined ? undefined : flexRender(cell.column.columnDef.cell, cell.getContext())
}

const CONTENT_CLASSES = 'flex min-w-0 flex-col gap-0.5'
const ITEM_CLASSES = `${CONTENT_CLASSES} px-3 py-2`

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

/**
 * The item's content, under the button that opens its row when the grid opens
 * rows. The button is the content's sibling, stretched over the item: a tap on
 * the text passes through to it (`pointer-events-none`), while a link or a
 * control a cell draws takes its own taps.
 */
function PhoneRowOpener({
  row,
  rowAction,
  children,
}: {
  readonly row: DataTableRow
  readonly rowAction: RowActionContext | undefined
  readonly children: ReactNode
}): ReactNode {
  const contentId = useId()
  if (rowAction === undefined) return children
  return (
    <>
      <button
        type="button"
        data-table-phone-row-open=""
        aria-labelledby={contentId}
        className="hover:bg-muted/50 focus-visible:ring-ring/50 absolute inset-0 w-full outline-none focus-visible:ring-[3px]"
        onClick={(event) => performRowAction(row, rowAction, event.currentTarget)}
      />
      <span
        id={contentId}
        className={`${CONTENT_CLASSES} pointer-events-none relative [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto`}
      >
        {children}
      </span>
    </>
  )
}

/**
 * The grid's New row entry under the phone items: the same trailing add-row
 * the grid draws, over the field columns only, so `phoneLayout: rows` changes
 * how each row reads and never what the grid offers. Absent when the role
 * cannot create, exactly as on a wide screen.
 */
export function PhoneAddRow({ grid }: { readonly grid: TableContentProps }) {
  const fieldColumns = grid.table
    .getVisibleLeafColumns()
    .filter((column) => column.columnDef.meta?.field !== undefined)
  const config = resolveAddRow(
    grid,
    fieldColumns,
    columnLabelResolver(grid.columnConfig, grid.fieldMeta)
  )
  if (config === undefined) return null
  return (
    <div className="overflow-x-auto">
      <table
        data-slot="table"
        className="w-full"
      >
        <tbody data-slot="table-body">
          <AddRow config={config} />
        </tbody>
      </table>
    </div>
  )
}
