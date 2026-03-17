/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  flexRender,
  type ColumnDef,
  type Header,
  type HeaderGroup,
  type Row,
} from '@tanstack/react-table'
import { evaluateCellStyle } from './data-table-formatting'
import type { TableRecord } from './shared/types'
import type { CellStyleCondition } from '@/domain/models/app/page/common/data-table'
import type { ReactElement } from 'react'

interface TableHeaderProps {
  readonly headerGroups: readonly HeaderGroup<TableRecord>[]
  readonly cellClass: string
}

interface TableBodyRowsProps {
  readonly rows: readonly Row<TableRecord>[]
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly isLoading: boolean
  readonly cellClass: string
  readonly borderClass: string
  readonly striped: boolean
  readonly emptyMessage: string
  readonly selectionMode?: 'none' | 'single' | 'multiple'
}

/**
 * Renders a single header cell with sort indicator
 */
function HeaderCell({
  header,
  cellClass,
}: {
  readonly header: Header<TableRecord, unknown>
  readonly cellClass: string
}) {
  const meta = header.column.columnDef.meta as { frozen?: boolean; field?: string } | undefined
  return (
    <th
      key={header.id}
      className={`${cellClass} text-left text-xs font-medium tracking-wider text-gray-500 uppercase ${
        header.column.getCanSort() ? 'cursor-pointer select-none' : ''
      }`}
      onClick={header.column.getToggleSortingHandler()}
      aria-sort={
        header.column.getIsSorted() === 'asc'
          ? 'ascending'
          : header.column.getIsSorted() === 'desc'
            ? 'descending'
            : 'none'
      }
      {...(meta?.frozen && { 'data-frozen': 'true' })}
    >
      <div className="flex items-center gap-1">
        {header.isPlaceholder
          ? undefined
          : flexRender(header.column.columnDef.header, header.getContext())}
        {header.column.getIsSorted() === 'asc' && <span aria-hidden="true">↑</span>}
        {header.column.getIsSorted() === 'desc' && <span aria-hidden="true">↓</span>}
      </div>
    </th>
  )
}

/**
 * Renders the table header with sortable columns
 */
export function TableHeader({ headerGroups, cellClass }: TableHeaderProps): ReactElement {
  return (
    <thead className="bg-gray-50">
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <HeaderCell
              key={header.id}
              header={header}
              cellClass={cellClass}
            />
          ))}
        </tr>
      ))}
    </thead>
  )
}

/**
 * Renders loading skeleton rows
 */
function SkeletonRows({
  allColumns,
  cellClass,
}: {
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly cellClass: string
}): ReactElement {
  return (
    <tbody className="divide-y divide-gray-200 bg-white">
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={`skeleton-${String(i)}`}>
          {allColumns.map((_, j) => (
            <td
              key={`skeleton-cell-${String(j)}`}
              className={cellClass}
            >
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

/**
 * Renders the table body: loading skeletons, data rows, or empty state
 */
// eslint-disable-next-line max-lines-per-function -- Complex table body with selection, styling, data attributes
export function TableBodyRows({
  rows,
  allColumns,
  isLoading,
  cellClass,
  borderClass,
  striped,
  emptyMessage,
  selectionMode,
}: TableBodyRowsProps): ReactElement {
  if (isLoading) {
    return (
      <SkeletonRows
        allColumns={allColumns}
        cellClass={cellClass}
      />
    )
  }

  if (rows.length === 0) {
    return (
      <tbody className="divide-y divide-gray-200 bg-white">
        <tr>
          <td
            colSpan={allColumns.length}
            className="py-8 text-center text-sm text-gray-500"
          >
            {emptyMessage}
          </td>
        </tr>
      </tbody>
    )
  }

  const handleRowClick = (row: Row<TableRecord>) => {
    if (selectionMode !== 'single') return
    // For single selection, deselect all others and toggle this row
    row.toggleSelected(!row.getIsSelected())
  }

  return (
    <tbody className="divide-y divide-gray-200 bg-white">
      {rows.map((row, rowIndex) => (
        <tr
          key={row.id}
          className={`transition-colors hover:bg-gray-50 ${
            striped && rowIndex % 2 === 1 ? 'bg-gray-50' : ''
          } ${row.getIsSelected() ? 'bg-blue-50' : ''}`}
          {...(row.getIsSelected() && { 'aria-selected': 'true' as const })}
          {...(selectionMode === 'single' && {
            onClick: () => handleRowClick(row),
            style: { cursor: 'pointer' },
          })}
        >
          {row.getVisibleCells().map((cell) => {
            const meta = cell.column.columnDef.meta as
              | { field?: string; cellStyle?: readonly CellStyleCondition[] }
              | undefined
            const conditionalClass = meta?.cellStyle
              ? evaluateCellStyle(cell.getValue(), meta.cellStyle)
              : ''
            return (
              <td
                key={cell.id}
                className={`${cellClass} ${borderClass} whitespace-nowrap ${conditionalClass}`}
                {...(meta?.field && { 'data-field': meta.field })}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            )
          })}
        </tr>
      ))}
    </tbody>
  )
}
