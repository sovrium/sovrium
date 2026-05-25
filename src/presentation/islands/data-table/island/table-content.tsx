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
  readonly records: readonly TableRecord[]
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly isLoading: boolean
  readonly striped: boolean
  readonly currentRowHeight: string
  readonly cellClass: string
  readonly borderClass: string
  readonly emptyMessage: string
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
}

export function TableContent(props: TableContentProps) {
  const { table, records, striped, currentRowHeight, cellClass, groupByConfig, summaryConfig } =
    props
  return (
    <div className="overflow-x-auto">
      <table
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
          selectionMode={props.selectionMode}
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
