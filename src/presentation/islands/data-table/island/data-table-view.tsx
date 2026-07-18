/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ImportCsvDialog } from '../import-csv-dialog'
import { SaveStatusIndicator } from '../save-status-indicator'
import { BulkActionBar } from './bulk-actions'
import { ConflictToast } from './conflict-toast'
import { CreateRecordDialog } from './create-record-dialog'
import { DeleteViewConfirmDialog } from './delete-view-confirm-dialog'
import { FilterOverlay } from './filter-overlay'
import { PaginationControls } from './pagination'
import { SaveViewDialog } from './save-view-dialog'
import { SortOverlay } from './sort-overlay'
import { TableContent } from './table-content'
import { DataTableToolbarBar, SearchToolbar } from './toolbar'
import type { SaveIndicatorSettings } from './use-island-setup'
import type { useDataTableUiState } from './use-ui-state'
import type { ViewsMenuEntry } from './views-menu'
import type {
  EditingCell,
  FieldMetaMap,
  SaveStatus,
  SaveTarget,
} from '../../hooks/use-inline-editing'
import type { DetectedConflict } from '../../hooks/use-realtime-reconciliation'
import type { RealtimeConnectionState } from '../../hooks/use-realtime-subscription'
import type { RowDensity } from '../../hooks/use-table-preferences'
import type { TableRecord } from '../../shared/types'
import type { DataTableRowClickAction, InlineAutoSave } from '../body'
import type {
  DataTableBulkAction,
  DataTableGroupBy,
  DataTablePagination,
  DataTableSearch,
  DataTableSelection,
  DataTableSummaryItem,
  DataTableToolbar,
} from '@/domain/models/app/pages/components/data-table'
import type { ColumnDef, useReactTable } from '@tanstack/react-table'

interface DataTableViewProps {
  readonly containerRef?: React.Ref<HTMLDivElement>
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
  readonly ariaLabel?: string
  readonly tableName: string
  readonly records: readonly TableRecord[]
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly totalRecords: number
  readonly isLoading: boolean
  readonly searchConfig?: DataTableSearch
  readonly selectionConfig?: DataTableSelection
  readonly toolbarConfig?: DataTableToolbar
  readonly bulkActionsConfig?: readonly DataTableBulkAction[]
  readonly paginationConfig?: DataTablePagination
  readonly groupByConfig?: DataTableGroupBy
  readonly summaryConfig?: readonly DataTableSummaryItem[]
  readonly tableFields?: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly globalFilter: string
  readonly setGlobalFilter: (value: string) => void
  readonly striped: boolean
  readonly currentRowHeight: string
  readonly cellClass: string
  readonly borderClass: string
  readonly emptyMessage: string
  readonly noMatchMessage?: string
  readonly selectedCount: number
  readonly showSearch: boolean
  readonly editingCell?: EditingCell
  readonly autoSave?: InlineAutoSave
  readonly saveError?: string
  readonly saveStatus?: SaveStatus
  readonly saveTarget?: SaveTarget
  readonly saveIndicator?: SaveIndicatorSettings
  readonly onRowClickAction?: DataTableRowClickAction
  readonly onCellDoubleClick: (rowId: string | number, field: string, currentValue: unknown) => void
  readonly onEditSave: (newValue: unknown) => Promise<void>
  readonly onEditCancel: () => void
  readonly onRefresh: () => void
  readonly canCreate: boolean
  readonly newRecordLabel: string
  readonly creating: boolean
  readonly onCreate: () => void
  readonly onCancelCreate: () => void
  readonly onSubmitCreate: (values: Record<string, string>) => void
  readonly readOnly?: boolean
  readonly systemExportEndpoint?: string
  readonly currentDensity: RowDensity
  readonly onSelectDensity: (density: RowDensity) => void
  readonly onResetPreferences?: () => void
  readonly activeViewName?: string
  readonly onBulkExecute: (action: DataTableBulkAction) => void
  readonly conflict?: DetectedConflict
  readonly onDismissConflict?: () => void
  readonly connectionStatus?: RealtimeConnectionState
  readonly ui: ReturnType<typeof useDataTableUiState>
  readonly viewsEnabled: boolean
  readonly viewEntries: ReadonlyArray<ViewsMenuEntry>
  readonly canSaveCurrentView: boolean
  readonly isViewModified: boolean
  readonly onSelectView: (entry: ViewsMenuEntry) => void
  readonly onSaveNewView: (name: string) => Promise<void>
  readonly onSaveModifiedView: () => void
  readonly onConfirmDeleteView: () => Promise<void>
}

export function DataTableView({
  containerRef,
  table,
  ariaLabel,
  tableName,
  records,
  allColumns,
  totalRecords,
  isLoading,
  searchConfig,
  selectionConfig,
  toolbarConfig,
  bulkActionsConfig,
  paginationConfig,
  groupByConfig,
  summaryConfig,
  tableFields,
  fieldMeta,
  globalFilter,
  setGlobalFilter,
  striped,
  currentRowHeight,
  cellClass,
  borderClass,
  emptyMessage,
  noMatchMessage,
  selectedCount,
  showSearch,
  editingCell,
  autoSave,
  saveError,
  saveStatus,
  saveTarget,
  saveIndicator,
  onRowClickAction,
  onCellDoubleClick,
  onEditSave,
  onEditCancel,
  onRefresh,
  canCreate,
  newRecordLabel,
  creating,
  onCreate,
  onCancelCreate,
  onSubmitCreate,
  readOnly = false,
  systemExportEndpoint,
  currentDensity,
  onSelectDensity,
  onResetPreferences,
  activeViewName,
  onBulkExecute,
  conflict,
  onDismissConflict,
  connectionStatus,
  ui,
  viewsEnabled,
  viewEntries,
  canSaveCurrentView,
  isViewModified,
  onSelectView,
  onSaveNewView,
  onSaveModifiedView,
  onConfirmDeleteView,
}: DataTableViewProps) {
  const showToolbar = true

  const indicatorOn = saveIndicator?.show === true
  const indicatorStatus: SaveStatus = saveStatus ?? 'idle'
  const inlineSaveStatus =
    indicatorOn && saveIndicator?.position === 'inline' ? indicatorStatus : undefined
  const showToolbarIndicator = indicatorOn && saveIndicator?.position === 'toolbar'
  const showToastIndicator = indicatorOn && saveIndicator?.position === 'toast'
  void saveTarget

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden"
      data-connection-status={connectionStatus}
    >
      {showToastIndicator && indicatorStatus !== 'idle' && (
        <div className="pointer-events-none fixed right-4 bottom-4 z-50">
          <div className="border-border bg-background-overlay rounded-md border px-3 py-2 shadow-lg">
            <SaveStatusIndicator status={indicatorStatus} />
          </div>
        </div>
      )}
      {saveError && (
        <div
          role="alert"
          data-save-status="error"
          className="border-error-border bg-error-bg text-error-fg border-b px-4 py-2 text-sm"
        >
          Error saving changes: {saveError}
        </div>
      )}
      {conflict && onDismissConflict && (
        <ConflictToast
          key={conflict.token}
          conflict={conflict}
          onDismiss={onDismissConflict}
        />
      )}
      {showToolbar && (
        <DataTableToolbarBar
          table={table}
          tableName={tableName}
          toolbarConfig={toolbarConfig}
          searchConfig={searchConfig}
          selectionConfig={selectionConfig}
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          importDialogOpen={ui.importDialogOpen}
          onOpenImportDialog={ui.onOpenImportDialog}
          onOpenFilterOverlay={ui.onOpenFilterOverlay}
          onOpenSortOverlay={ui.onOpenSortOverlay}
          activeSortCount={ui.activeSorts.length}
          activeView={ui.activeView}
          onSelectGridView={ui.setActiveViewGrid}
          onSelectKanbanView={ui.setActiveViewKanban}
          groupableFields={tableFields ?? []}
          runtimeGroupBy={ui.runtimeGroupBy}
          onSelectRuntimeGroupBy={ui.setRuntimeGroupBy}
          columnsMenuOpen={ui.columnsMenuOpen}
          onToggleColumnsMenu={ui.onToggleColumnsMenu}
          exportMenuOpen={ui.exportMenuOpen}
          onToggleExportMenu={ui.onToggleExportMenu}
          onCloseExportMenu={ui.onCloseExportMenu}
          onRefresh={onRefresh}
          canCreate={canCreate}
          newRecordLabel={newRecordLabel}
          onCreate={onCreate}
          readOnly={readOnly}
          {...(systemExportEndpoint !== undefined && { systemExportEndpoint })}
          currentDensity={currentDensity}
          onSelectDensity={onSelectDensity}
          {...(onResetPreferences && { onResetPreferences })}
          {...(activeViewName && { activeViewName })}
          activeFilter={ui.activeFilter}
          activeFilterCount={ui.activeFilters.length}
          selectedCount={selectedCount}
          showSearch={showSearch}
          viewsEnabled={viewsEnabled}
          viewEntries={viewEntries}
          canSaveCurrentView={canSaveCurrentView}
          isViewModified={isViewModified}
          activeViewSource={ui.activeViewSource}
          onOpenSaveViewDialog={ui.onOpenSaveViewDialog}
          onSelectView={onSelectView}
          onDeleteView={(entry) => ui.onOpenDeleteViewDialog({ id: entry.id, name: entry.name })}
          onSaveModifiedView={onSaveModifiedView}
          saveStatus={showToolbarIndicator ? indicatorStatus : undefined}
        />
      )}
      {creating && (
        <CreateRecordDialog
          fields={tableFields ?? []}
          {...(fieldMeta && { fieldMeta })}
          title={newRecordLabel}
          onCancel={onCancelCreate}
          onSubmit={onSubmitCreate}
        />
      )}
      <SaveViewDialog
        open={ui.saveViewDialogOpen}
        onOpenChange={(o) => (o ? ui.onOpenSaveViewDialog() : ui.onCloseSaveViewDialog())}
        onSave={onSaveNewView}
      />
      {ui.deleteViewTarget && (
        <DeleteViewConfirmDialog
          open={ui.deleteViewTarget !== null}
          onOpenChange={(o) => (!o ? ui.onCloseDeleteViewDialog() : undefined)}
          viewName={ui.deleteViewTarget.name}
          onConfirm={onConfirmDeleteView}
        />
      )}
      {!showToolbar && showSearch && searchConfig && (
        <div className="border-border border-b p-3">
          <SearchToolbar
            search={searchConfig}
            value={globalFilter}
            onChange={setGlobalFilter}
          />
        </div>
      )}
      {bulkActionsConfig && bulkActionsConfig.length > 0 && (
        <BulkActionBar
          bulkActions={bulkActionsConfig}
          selectedCount={selectedCount}
          onExecute={onBulkExecute}
        />
      )}
      {!ui.importDialogOpen && ui.filterOverlayOpen && (
        <FilterOverlay
          tableFields={tableFields ?? []}
          fieldMeta={fieldMeta}
          activeFilters={ui.activeFilters}
          filterConjunction={ui.filterConjunction}
          onAddFilter={ui.addFilter}
          onRemoveFilter={ui.removeFilter}
          onClearAll={ui.clearAllFilters}
          onToggleConjunction={ui.toggleConjunction}
        />
      )}
      {!ui.importDialogOpen && ui.sortOverlayOpen && (
        <SortOverlay
          tableFields={tableFields ?? []}
          activeSorts={ui.activeSorts}
          onAddSort={ui.addSort}
          onRemoveSort={ui.removeSort}
          onClearAll={ui.clearAllSorts}
          onReorderSort={ui.reorderSort}
        />
      )}
      {!ui.importDialogOpen && (
        <TableContent
          table={table}
          {...(ariaLabel && { ariaLabel })}
          useGridRole={!readOnly}
          records={records}
          allColumns={allColumns}
          isLoading={isLoading}
          striped={striped}
          currentRowHeight={currentRowHeight}
          cellClass={cellClass}
          borderClass={borderClass}
          emptyMessage={emptyMessage}
          {...(noMatchMessage !== undefined && { noMatchMessage })}
          globalFilter={globalFilter}
          selectionMode={selectionConfig?.mode}
          groupByConfig={groupByConfig}
          summaryConfig={summaryConfig}
          editingCell={editingCell}
          fieldMeta={fieldMeta}
          tableName={tableName}
          autoSave={autoSave}
          inlineSaveStatus={inlineSaveStatus}
          onRowClickAction={onRowClickAction}
          onCellDoubleClick={onCellDoubleClick}
          onEditSave={onEditSave}
          onEditCancel={onEditCancel}
          collapsedGroups={ui.collapsedGroups}
          onToggleGroupCollapsed={ui.toggleGroupCollapsed}
        />
      )}
      {!ui.importDialogOpen && paginationConfig && (
        <PaginationControls
          table={table}
          total={totalRecords}
          pageSizeOptions={paginationConfig.pageSizeOptions}
        />
      )}
      <ImportCsvDialog
        open={ui.importDialogOpen}
        onClose={ui.onCloseImportDialog}
        tableFields={tableFields}
        tableName={tableName}
        fieldMeta={fieldMeta}
      />
    </div>
  )
}
