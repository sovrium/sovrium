/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { TableBodyRows, TableHeader, TableSummaryFooter } from '../body'
import type { EditingCell, FieldMetaMap, SaveStatus } from '../../hooks/use-inline-editing'
import type { TableRecord } from '../../shared/types'
import type { DataTableRowClickAction, InlineAutoSave } from '../body'
import type {
  DataTableGroupBy,
  DataTableSummaryItem,
} from '@/domain/models/app/pages/components/data-table'
import type { ColumnDef, useReactTable } from '@tanstack/react-table'

interface TableContentProps {
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
  readonly ariaLabel?: string
  readonly useGridRole?: boolean
  readonly records: readonly TableRecord[]
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly isLoading: boolean
  readonly striped: boolean
  readonly currentRowHeight: string
  readonly cellClass: string
  readonly borderClass: string
  readonly emptyMessage: string
  readonly noMatchMessage?: string
  readonly globalFilter?: string
  readonly selectionMode?: 'none' | 'single' | 'multiple'
  readonly groupByConfig?: DataTableGroupBy
  readonly summaryConfig?: readonly DataTableSummaryItem[]
  readonly editingCell?: EditingCell
  readonly fieldMeta?: FieldMetaMap
  readonly tableName: string
  readonly autoSave?: InlineAutoSave
  readonly inlineSaveStatus?: SaveStatus
  readonly onRowClickAction?: DataTableRowClickAction
  readonly onCellDoubleClick: (rowId: string | number, field: string, currentValue: unknown) => void
  readonly onEditSave: (newValue: unknown) => Promise<void>
  readonly onEditCancel: () => void
  readonly collapsedGroups?: ReadonlyArray<string>
  readonly onToggleGroupCollapsed?: (groupValue: string) => void
}

function resolveTableAria(
  ariaLabel: string | undefined,
  useGridRole: boolean | undefined
): { readonly hasAriaLabel: boolean; readonly gridRole: boolean } {
  const hasAriaLabel = ariaLabel !== undefined && ariaLabel.length > 0
  return { hasAriaLabel, gridRole: hasAriaLabel && useGridRole !== false }
}

export function TableContent(props: TableContentProps) {
  const { table, records, striped, currentRowHeight, cellClass, groupByConfig, summaryConfig } =
    props
  const { hasAriaLabel, gridRole } = resolveTableAria(props.ariaLabel, props.useGridRole)
  return (
    <div className="overflow-x-auto">
      <table
        {...(gridRole && { role: 'grid' })}
        {...(hasAriaLabel && { 'aria-label': props.ariaLabel })}
        className="divide-border min-w-full divide-y"
        data-striped={String(striped)}
        data-row-height={currentRowHeight}
      >
        {}
        <TableHeader headerGroups={table.getHeaderGroups()} cellClass={cellClass} />
        <TableBodyRows
          rows={table.getRowModel().rows}
          allColumns={props.allColumns}
          isLoading={props.isLoading}
          cellClass={cellClass}
          borderClass={props.borderClass}
          striped={striped}
          emptyMessage={props.emptyMessage}
          {...(props.noMatchMessage !== undefined && { noMatchMessage: props.noMatchMessage })}
          globalFilter={props.globalFilter}
          hasRecords={records.length > 0}
          selectionMode={props.selectionMode}
          gridRole={gridRole}
          rowModel={groupByConfig ? table.getExpandedRowModel() : undefined}
          editingCell={props.editingCell}
          fieldMeta={props.fieldMeta}
          tableName={props.tableName}
          autoSave={props.autoSave}
          inlineSaveStatus={props.inlineSaveStatus}
          onRowClickAction={props.onRowClickAction}
          onCellDoubleClick={props.onCellDoubleClick}
          onEditSave={props.onEditSave}
          onEditCancel={props.onEditCancel}
          {...(props.collapsedGroups && { collapsedGroups: props.collapsedGroups })}
          {...(props.onToggleGroupCollapsed && {
            onToggleGroupCollapsed: props.onToggleGroupCollapsed,
          })}
        />
        {summaryConfig && summaryConfig.length > 0 && (
          <TableSummaryFooter
            summary={summaryConfig}
            records={records}
            cellClass={cellClass}
          />
        )}
      </table>
    </div>
  )
}
