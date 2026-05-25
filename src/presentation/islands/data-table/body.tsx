/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  flexRender,
  type Cell,
  type ColumnDef,
  type Header,
  type HeaderGroup,
  type Row,
  type RowModel,
} from '@tanstack/react-table'
import { EditableCell } from './editable-cell'
import { evaluateCellStyle } from './formatting'
import { SaveStatusIndicator } from './save-status-indicator'
import type { EditingCell, FieldMetaMap, SaveStatus } from '../hooks/use-inline-editing'
import type { TableRecord } from '../shared/types'
import type {
  CellStyleCondition,
  DataTableSummaryItem,
  SummaryFunction,
} from '@/domain/models/app/pages/components/data-table'
import type { ReactElement } from 'react'

interface TableHeaderProps {
  readonly headerGroups: readonly HeaderGroup<TableRecord>[]
  readonly cellClass: string
}

export interface InlineAutoSave {
  readonly enabled: boolean
  readonly debounceMs: number
  readonly saveOnBlur?: boolean
  readonly onAutoSave: (newValue: unknown) => void | Promise<void>
  readonly onTrackValue: (newValue: unknown) => void
  readonly onTabNext: (rowId: string | number, currentField: string, newValue: unknown) => void
}

export type DataTableRowClickAction = { readonly type: 'navigate'; readonly path: string }

interface TableBodyRowsProps {
  readonly rows: readonly Row<TableRecord>[]
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly isLoading: boolean
  readonly cellClass: string
  readonly borderClass: string
  readonly striped: boolean
  readonly emptyMessage: string
  readonly selectionMode?: 'none' | 'single' | 'multiple'
  readonly editingCell?: EditingCell
  readonly fieldMeta?: FieldMetaMap
  readonly tableName?: string
  readonly autoSave?: InlineAutoSave
  readonly inlineSaveStatus?: SaveStatus
  readonly onRowClickAction?: DataTableRowClickAction
  readonly onCellDoubleClick?: (rowId: string | number, field: string, value: unknown) => void
  readonly onEditSave?: (newValue: unknown) => void
  readonly onEditCancel?: () => void
}

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
      className={`${cellClass} text-foreground-muted text-left text-xs font-medium tracking-wider uppercase ${
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
        {}
        {header.column.getIsSorted() === 'asc' && (
          <span
            aria-label="sorted ascending"
            aria-hidden="true"
            className="sort-asc"
          >
            ↑
          </span>
        )}
        {header.column.getIsSorted() === 'desc' && (
          <span
            aria-label="sorted descending"
            aria-hidden="true"
            className="sort-desc"
          >
            ↓
          </span>
        )}
      </div>
    </th>
  )
}

export function TableHeader({ headerGroups, cellClass }: TableHeaderProps): ReactElement {
  return (
    <thead className="bg-background-subtle">
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


interface CellContentProps {
  readonly cell: Cell<TableRecord, unknown>
  readonly meta:
    | { field?: string; editable?: boolean; cellStyle?: readonly CellStyleCondition[] }
    | undefined
  readonly editingCell?: EditingCell
  readonly fieldMeta?: FieldMetaMap
  readonly tableName?: string
  readonly autoSave?: InlineAutoSave
  readonly inlineSaveStatus?: SaveStatus
  readonly onCellDoubleClick?: (rowId: string | number, field: string, value: unknown) => void
  readonly onEditSave?: (newValue: unknown) => void
  readonly onEditCancel?: () => void
}

function isEditingThisCell(
  editingCell: EditingCell | undefined,
  field: string | undefined,
  rowId: string | number | undefined
): boolean {
  return Boolean(
    editingCell &&
    field &&
    rowId !== undefined &&
    editingCell.rowId === rowId &&
    editingCell.field === field
  )
}

function renderCellContent({
  cell,
  meta,
  editingCell,
  fieldMeta,
  tableName,
  autoSave,
  inlineSaveStatus,
  onCellDoubleClick,
  onEditSave,
  onEditCancel,
}: CellContentProps): { content: React.ReactNode; onDoubleClick?: () => void } {
  const field = meta?.field
  const rowId = cell.row.original.id as string | number | undefined

  if (isEditingThisCell(editingCell, field, rowId) && field && onEditSave && onEditCancel) {
    const autoSaveEnabled = Boolean(autoSave?.enabled)
    return {
      content: (
        <div className="flex items-center gap-1">
          <EditableCell
            value={editingCell!.value}
            fieldMeta={fieldMeta?.[field]}
            onSave={onEditSave}
            onCancel={onEditCancel}
            tableName={tableName}
            recordId={rowId}
            fieldName={field}
            autoSave={autoSaveEnabled}
            autoSaveDebounceMs={autoSave?.debounceMs}
            saveOnBlur={autoSave?.saveOnBlur === true}
            {...(autoSave && {
              onAutoSave: autoSave.onAutoSave,
              onTrackValue: autoSave.onTrackValue,
              onTabNext: (newValue: unknown) =>
                rowId !== undefined && autoSave.onTabNext(rowId, field, newValue),
            })}
          />
          {inlineSaveStatus && <SaveStatusIndicator status={inlineSaveStatus} />}
        </div>
      ),
    }
  }

  const content = flexRender(cell.column.columnDef.cell, cell.getContext())
  const canEdit = meta?.editable === true && field && rowId !== undefined && onCellDoubleClick

  return {
    content,
    onDoubleClick: canEdit ? () => onCellDoubleClick(rowId, field, cell.getValue()) : undefined,
  }
}

function SkeletonRows({
  allColumns,
  cellClass,
}: {
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly cellClass: string
}): ReactElement {
  return (
    <tbody className="divide-border bg-background-raised divide-y">
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={`skeleton-${String(i)}`}>
          {allColumns.map((_, j) => (
            <td
              key={`skeleton-cell-${String(j)}`}
              className={cellClass}
            >
              <div className="bg-background-subtle h-4 w-3/4 animate-pulse rounded" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

function GroupedTableBodyRows({
  rowModel,
  allColumns,
  cellClass,
  borderClass,
  striped,
  selectionMode,
}: {
  readonly rowModel: RowModel<TableRecord>
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly cellClass: string
  readonly borderClass: string
  readonly striped: boolean
  readonly selectionMode?: 'none' | 'single' | 'multiple'
}): ReactElement {
  const handleRowClick = (row: Row<TableRecord>) => {
    if (selectionMode !== 'single') return
    row.toggleSelected(!row.getIsSelected())
  }

  return (
    <tbody className="divide-border bg-background-raised divide-y">
      {}
      {rowModel.rows.map((row, rowIndex) => {
        if (row.getIsGrouped()) {
          return (
            <tr
              key={row.id}
              data-group-header="true"
              data-group="true"
              data-group-value={row.groupingValue}
              role="row"
              className="bg-background-subtle hover:bg-background-subtle"
            >
              <td
                colSpan={allColumns.length}
                className={`${cellClass} ${borderClass} text-foreground font-medium`}
              >
                {String(row.groupingValue)} ({row.subRows.length})
              </td>
            </tr>
          )
        }

        return (
          <tr
            key={row.id}
            className={`hover:bg-background-subtle transition-colors ${
              striped && rowIndex % 2 === 1 ? 'bg-background-subtle' : ''
            } ${row.getIsSelected() ? 'bg-primary-subtle' : ''}`}
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
        )
      })}
    </tbody>
  )
}

function resolveRowClickPath(path: string, row: TableRecord): string {
  return path.replace(/\{([^}]+)\}/g, (_match, field: string) => {
    const value = row[field]
    return value === null || value === undefined ? '' : String(value)
  })
}

export function TableBodyRows({
  rows,
  allColumns,
  isLoading,
  cellClass,
  borderClass,
  striped,
  emptyMessage,
  selectionMode,
  rowModel,
  editingCell,
  fieldMeta,
  tableName,
  autoSave,
  inlineSaveStatus,
  onRowClickAction,
  onCellDoubleClick,
  onEditSave,
  onEditCancel,
}: TableBodyRowsProps & { readonly rowModel?: RowModel<TableRecord> }): ReactElement {
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
      <tbody className="divide-border bg-background-raised divide-y">
        <tr>
          <td
            colSpan={allColumns.length}
            className="text-foreground-muted py-8 text-center text-sm"
          >
            {emptyMessage}
          </td>
        </tr>
      </tbody>
    )
  }

  if (rowModel) {
    return (
      <GroupedTableBodyRows
        rowModel={rowModel}
        allColumns={allColumns}
        cellClass={cellClass}
        borderClass={borderClass}
        striped={striped}
        selectionMode={selectionMode}
      />
    )
  }

  const handleRowClick = (row: Row<TableRecord>) => {
    if (onRowClickAction && onRowClickAction.type === 'navigate') {
      const resolved = resolveRowClickPath(onRowClickAction.path, row.original)
      if (typeof window !== 'undefined') window.location.assign(resolved)
      return
    }
    if (selectionMode !== 'single') return
    row.toggleSelected(!row.getIsSelected())
  }

  const rowIsClickable = onRowClickAction !== undefined || selectionMode === 'single'

  return (
    <tbody className="divide-border bg-background-raised divide-y">
      {rows.map((row, rowIndex) => (
        <tr
          key={row.id}
          data-row-id={String(row.original.id ?? row.id)}
          className={`hover:bg-background-subtle transition-colors ${
            striped && rowIndex % 2 === 1 ? 'bg-background-subtle' : ''
          } ${row.getIsSelected() ? 'bg-primary-subtle' : ''}`}
          {...(row.getIsSelected() && { 'aria-selected': 'true' as const })}
          {...(rowIsClickable && {
            onClick: () => handleRowClick(row),
            style: { cursor: 'pointer' },
          })}
        >
          {row.getVisibleCells().map((cell) => {
            const meta = cell.column.columnDef.meta as
              | { field?: string; editable?: boolean; cellStyle?: readonly CellStyleCondition[] }
              | undefined
            const conditionalClass = meta?.cellStyle
              ? evaluateCellStyle(cell.getValue(), meta.cellStyle)
              : ''
            const { content, onDoubleClick } = renderCellContent({
              cell,
              meta,
              editingCell,
              fieldMeta,
              tableName,
              autoSave,
              inlineSaveStatus,
              onCellDoubleClick,
              onEditSave,
              onEditCancel,
            })
            return (
              <td
                key={cell.id}
                className={`${cellClass} ${borderClass} whitespace-nowrap ${conditionalClass}`}
                {...(meta?.field && { 'data-field': meta.field })}
                {...(onDoubleClick && { onDoubleClick })}
              >
                {content}
              </td>
            )
          })}
        </tr>
      ))}
    </tbody>
  )
}


function computeAggregate(
  records: readonly TableRecord[],
  field: string,
  fn: SummaryFunction
): number {
  if (fn === 'count') return records.length

  const values = records.map((r) => Number(r[field])).filter((v) => !Number.isNaN(v))

  if (values.length === 0) return 0

  switch (fn) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
  }
}

export function TableSummaryFooter({
  summary,
  records,
  cellClass,
}: {
  readonly summary: readonly DataTableSummaryItem[]
  readonly records: readonly TableRecord[]
  readonly cellClass: string
}): ReactElement {
  return (
    <tfoot data-summary="true">
      <tr
        role="row"
        className="bg-background-subtle font-medium"
      >
        {summary.map((item, i) => {
          const value = computeAggregate(records, item.field, item.function)
          return (
            <td
              key={`summary-${String(i)}`}
              className={`${cellClass} text-foreground whitespace-nowrap`}
            >
              {item.label ? `${item.label}: ` : ''}
              {value}
            </td>
          )
        })}
      </tr>
    </tfoot>
  )
}
