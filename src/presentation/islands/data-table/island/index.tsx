/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type FieldMetaMap } from '../../hooks/use-inline-editing'
import { type DataTableRowClickAction } from '../body'
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
    readonly refreshMode?: 'none' | 'poll' | 'realtime'
    readonly pollIntervalMs?: number
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
  readonly tableViews?: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly filters?: ReadonlyArray<{
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }>
    readonly sorts?: ReadonlyArray<{
      readonly field: string
      readonly direction: 'asc' | 'desc'
    }>
    readonly groupBy?: string | null
  }>
  readonly onRowClick?:
    | {
        readonly type?: string
        readonly action?: string
        readonly path?: string
        readonly component?: string
      }
    | undefined
}

function ErrorBanner({ error }: { readonly error: unknown }) {
  return (
    <div
      role="alert"
      className="border-error-border bg-error-bg text-error-fg rounded border p-4 text-sm"
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
    tableViews: props.tableViews,
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

function resolveRowClickAction(
  action: DataTableIslandProps['onRowClick']
): DataTableRowClickAction | undefined {
  if (!action) return undefined
  if (action.type === 'navigate' && typeof action.path === 'string') {
    return { type: 'navigate', path: action.path }
  }
  if (action.action === 'openDrawer' && typeof action.component === 'string') {
    return { type: 'openDrawer', component: action.component }
  }
  return undefined
}

export default function DataTableIsland(props: DataTableIslandProps) {
  const setup = useDataTableIslandSetup(toSetupParams(props))
  const clipboardRef = useClipboardCopy()
  const paste = usePasteImport(toPasteParams(props, clipboardRef, setup.handleRefresh))
  const onRowClickAction = resolveRowClickAction(props.onRowClick)

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
        isLoading={setup.isLoading || setup.isPrefsLoading}
        searchConfig={props.search}
        selectionConfig={props.selection}
        toolbarConfig={props.toolbar}
        bulkActionsConfig={props.bulkActions}
        paginationConfig={props.pagination}
        groupByConfig={setup.effectiveGroupByConfig}
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
        onRowClickAction={onRowClickAction}
        onCellDoubleClick={setup.inlineEditing.startEditing}
        onEditSave={setup.inlineEditing.saveEdit}
        onEditCancel={setup.inlineEditing.cancelEditing}
        onRefresh={setup.handleRefresh}
        currentDensity={setup.currentDensity}
        onSelectDensity={setup.onSelectDensity}
        onResetPreferences={setup.onResetPreferences}
        {...(setup.activeViewName && { activeViewName: setup.activeViewName })}
        onBulkExecute={setup.onBulkExecute}
        conflict={setup.conflict}
        onDismissConflict={setup.dismissConflict}
        connectionStatus={setup.connectionStatus}
        ui={setup.ui}
        viewsEnabled={setup.viewsEnabled}
        viewEntries={setup.viewEntries}
        canSaveCurrentView={setup.canSaveCurrentView}
        isViewModified={setup.isViewModified}
        onSelectView={setup.onSelectView}
        onSaveNewView={setup.onSaveNewView}
        onSaveModifiedView={setup.onSaveModifiedView}
        onConfirmDeleteView={setup.onConfirmDeleteView}
      />
    </>
  )
}
