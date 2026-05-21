/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type FieldMetaMap } from '../../hooks/use-inline-editing'
import { usePasteImport } from '../paste-preview/use-paste-import'
import { DataTableView } from './data-table-view'
import { useClipboardCopy } from './use-clipboard-copy'
import { useDataTableIslandSetup } from './use-island-setup'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTablePagination,
  DataTableSearch,
  DataTableSelection,
  DataTableToolbar,
  DataTableGroupBy,
  DataTableSummaryItem,
  RowHeight,
} from '@/domain/models/app/pages/components/data-table'

interface DataTableIslandProps {
  readonly dataSource: {
    readonly table: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
  }
  readonly columns?: readonly DataTableColumn[]
  readonly pagination?: DataTablePagination
  readonly search?: DataTableSearch
  readonly selection?: DataTableSelection
  readonly toolbar?: DataTableToolbar
  readonly bulkActions?: readonly DataTableBulkAction[]
  readonly striped?: boolean
  readonly bordered?: boolean
  readonly emptyMessage?: string
  readonly showRowNumbers?: boolean
  readonly rowHeight?: RowHeight
  readonly searchSourceId?: string
  readonly tableFields?: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly tablePermissions?: { readonly update?: readonly string[] }
  readonly groupBy?: DataTableGroupBy
  readonly summary?: readonly DataTableSummaryItem[]
  readonly autoSave?: AutoSaveConfig
}

function ErrorBanner({ error }: { readonly error: unknown }) {
  return (
    <div
      role="alert"
      className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      Failed to load data: {error instanceof Error ? error.message : 'Unknown error'}
    </div>
  )
}

function toSetupParams(props: DataTableIslandProps) {
  return {
    dataSource: props.dataSource,
    columnConfig: props.columns,
    paginationConfig: props.pagination,
    searchConfig: props.search,
    selectionConfig: props.selection,
    toolbarConfig: props.toolbar,
    initialRowHeight: props.rowHeight ?? 'medium',
    searchSourceId: props.searchSourceId,
    tableFields: props.tableFields,
    fieldMeta: props.fieldMeta,
    groupByConfig: props.groupBy,
    bordered: props.bordered ?? false,
    autoSaveConfig: props.autoSave,
  }
}

function toPasteParams(
  props: DataTableIslandProps,
  containerRef: React.RefObject<HTMLDivElement | null>,
  onImported: () => void
) {
  return {
    containerRef,
    tableName: props.dataSource.table,
    tableFields: props.tableFields ?? [],
    fieldMeta: props.fieldMeta,
    onImported,
  }
}

export default function DataTableIsland(props: DataTableIslandProps) {
  const setup = useDataTableIslandSetup(toSetupParams(props))
  const clipboardRef = useClipboardCopy()
  const paste = usePasteImport(toPasteParams(props, clipboardRef, setup.handleRefresh))

  if (setup.isError) return <ErrorBanner error={setup.error} />

  return (
    <>
      {paste.dialog}
      {paste.toast}
      <DataTableView
        containerRef={clipboardRef}
        table={setup.table}
        tableName={props.dataSource.table}
        records={setup.records}
        allColumns={setup.allColumns}
        totalRecords={setup.totalRecords}
        isLoading={setup.isLoading}
        searchConfig={props.search}
        selectionConfig={props.selection}
        toolbarConfig={props.toolbar}
        bulkActionsConfig={props.bulkActions}
        paginationConfig={props.pagination}
        groupByConfig={props.groupBy}
        summaryConfig={props.summary}
        tableFields={props.tableFields}
        fieldMeta={props.fieldMeta}
        globalFilter={setup.globalFilter}
        setGlobalFilter={setup.setGlobalFilter}
        striped={props.striped ?? false}
        currentRowHeight={setup.currentRowHeight}
        cellClass={setup.cellClass}
        borderClass={setup.borderClass}
        emptyMessage={props.emptyMessage ?? 'No records found'}
        selectedCount={Object.keys(setup.rowSelection).length}
        showSearch={setup.showSearch}
        editingCell={setup.inlineEditing.editingCell}
        autoSave={setup.inlineAutoSave}
        saveError={setup.inlineEditing.saveError}
        saveStatus={setup.inlineEditing.saveStatus}
        saveTarget={setup.inlineEditing.saveTarget}
        saveIndicator={setup.saveIndicator}
        onCellDoubleClick={setup.inlineEditing.startEditing}
        onEditSave={setup.inlineEditing.saveEdit}
        onEditCancel={setup.inlineEditing.cancelEditing}
        onRefresh={setup.handleRefresh}
        onToggleDensity={setup.toggleDensity}
        onBulkExecute={setup.onBulkExecute}
        ui={setup.ui}
      />
    </>
  )
}
