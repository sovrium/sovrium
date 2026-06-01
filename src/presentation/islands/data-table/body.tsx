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
  type Row,
  type RowModel,
} from '@tanstack/react-table'
import { substituteRecordVars } from '@/domain/utils/substitute-record-vars'
import { dispatch as dispatchIslandEvent } from '../_shared/event-bus'
import { EditableCell } from './editable-cell'
import { evaluateCellStyle } from './formatting'
import { SaveStatusIndicator } from './save-status-indicator'
import type { EditingCell, FieldMetaMap, SaveStatus } from '../hooks/use-inline-editing'
import type { TableRecord } from '../shared/types'
import type { CellStyleCondition } from '@/domain/models/app/pages/components/data-table'
import type { ReactElement } from 'react'

export { TableHeader } from './body-header'

export interface InlineAutoSave {
  readonly enabled: boolean
  readonly debounceMs: number
  readonly saveOnBlur?: boolean
  readonly onAutoSave: (newValue: unknown) => void | Promise<void>
  readonly onTrackValue: (newValue: unknown) => void
  readonly onTabNext: (rowId: string | number, currentField: string, newValue: unknown) => void
}

export type DataTableRowClickAction =
  | { readonly type: 'navigate'; readonly path: string }
  | { readonly type: 'openDrawer'; readonly component: string }

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
  readonly collapsedGroups?: ReadonlyArray<string>
  readonly onToggleGroupCollapsed?: (groupValue: string) => void
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
    <tbody
      className="divide-border bg-background-raised divide-y"
      aria-hidden="true"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <tr
          key={`skeleton-${String(i)}`}
          data-skeleton-row="true"
          className="pointer-events-none"
        >
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

function GroupHeaderRow({
  row,
  allColumns,
  cellClass,
  borderClass,
  isCollapsed,
  onToggle,
}: {
  readonly row: Row<TableRecord>
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly cellClass: string
  readonly borderClass: string
  readonly isCollapsed: boolean
  readonly onToggle?: (groupValue: string) => void
}): ReactElement {
  const groupValueRaw = row.groupingValue
  const groupValue = String(groupValueRaw ?? '')
  const handleToggle = onToggle ? () => onToggle(groupValue) : undefined
  return (
    <tr
      key={row.id}
      data-testid="group-header"
      data-group-header="true"
      data-group={groupValue}
      data-group-value={groupValueRaw}
      role="row"
      aria-expanded={!isCollapsed}
      className="group-header bg-background-subtle"
    >
      <td
        colSpan={allColumns.length}
        className={`${cellClass} ${borderClass} text-foreground cursor-pointer font-medium`}
        {...(handleToggle && { onClick: handleToggle })}
      >
        <span
          aria-hidden="true"
          className="mr-2"
        >
          {isCollapsed ? '▶' : '▼'}
        </span>
        {groupValue} ({row.subRows.length})
      </td>
    </tr>
  )
}

function GroupedDataRow({
  row,
  rowIndex,
  cellClass,
  borderClass,
  striped,
  selectionMode,
}: {
  readonly row: Row<TableRecord>
  readonly rowIndex: number
  readonly cellClass: string
  readonly borderClass: string
  readonly striped: boolean
  readonly selectionMode?: 'none' | 'single' | 'multiple'
}): ReactElement {
  const handleRowClick = () => {
    if (selectionMode !== 'single') return
    row.toggleSelected(!row.getIsSelected())
  }
  return (
    <tr
      key={row.id}
      className={`hover:bg-background-subtle transition-colors ${
        striped && rowIndex % 2 === 1 ? 'bg-background-subtle' : ''
      } ${row.getIsSelected() ? 'bg-primary-subtle' : ''}`}
      {...(row.getIsSelected() && { 'aria-selected': 'true' as const })}
      {...(selectionMode === 'single' && {
        onClick: handleRowClick,
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
}

function GroupedTableBodyRows({
  rowModel,
  allColumns,
  cellClass,
  borderClass,
  striped,
  selectionMode,
  collapsedGroups,
  onToggleGroupCollapsed,
}: {
  readonly rowModel: RowModel<TableRecord>
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly cellClass: string
  readonly borderClass: string
  readonly striped: boolean
  readonly selectionMode?: 'none' | 'single' | 'multiple'
  readonly collapsedGroups: ReadonlyArray<string>
  readonly onToggleGroupCollapsed?: (groupValue: string) => void
}): ReactElement {
  const collapsedSet = new Set(collapsedGroups)
  type GroupBucket = {
    readonly groupRow: Row<TableRecord>
    readonly dataRows: ReadonlyArray<Row<TableRecord>>
  }
  const groupBuckets: ReadonlyArray<GroupBucket> = rowModel.rows.reduce<ReadonlyArray<GroupBucket>>(
    (acc, row) => {
      if (row.getIsGrouped()) {
        return [...acc, { groupRow: row, dataRows: [] }]
      }
      const parent = row.getParentRow()
      if (parent?.getIsGrouped() !== true || acc.length === 0) return acc
      const last = acc[acc.length - 1]
      if (!last) return acc
      const head = acc.slice(0, -1)
      return [...head, { groupRow: last.groupRow, dataRows: [...last.dataRows, row] }]
    },
    []
  )
  return (
    <>
      {groupBuckets.map(({ groupRow, dataRows }) => {
        const groupValue = String(groupRow.groupingValue ?? '')
        const collapsed = collapsedSet.has(groupValue)
        return (
          <tbody
            key={groupRow.id}
            data-group={groupValue}
            data-testid={`group-${groupValue}`}
            className="divide-border bg-background-raised divide-y"
          >
            <GroupHeaderRow
              row={groupRow}
              allColumns={allColumns}
              cellClass={cellClass}
              borderClass={borderClass}
              isCollapsed={collapsed}
              {...(onToggleGroupCollapsed && { onToggle: onToggleGroupCollapsed })}
            />
            {!collapsed &&
              dataRows.map((row, rowIndex) => (
                <GroupedDataRow
                  key={row.id}
                  row={row}
                  rowIndex={rowIndex}
                  cellClass={cellClass}
                  borderClass={borderClass}
                  striped={striped}
                  selectionMode={selectionMode}
                />
              ))}
          </tbody>
        )
      })}
    </>
  )
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
  collapsedGroups,
  onToggleGroupCollapsed,
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
        collapsedGroups={collapsedGroups ?? []}
        {...(onToggleGroupCollapsed && { onToggleGroupCollapsed })}
      />
    )
  }

  const handleRowClick = (row: Row<TableRecord>) => {
    if (onRowClickAction && onRowClickAction.type === 'navigate') {
      const resolved = substituteRecordVars(onRowClickAction.path, row.original)
      if (typeof window !== 'undefined') window.location.assign(resolved)
      return
    }
    if (onRowClickAction && onRowClickAction.type === 'openDrawer') {
      dispatchIslandEvent('sovrium:open-drawer', {
        id: onRowClickAction.component,
        record: row.original,
      })
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


export { TableSummaryFooter } from './body-summary'
