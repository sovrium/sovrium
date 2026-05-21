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
import { FilterOverlay } from './filter-overlay'
import { PaginationControls } from './pagination'
import { TableContent } from './table-content'
import { DataTableToolbarBar, SearchToolbar } from './toolbar'
import type { SaveIndicatorSettings } from './use-island-setup'
import type { useDataTableUiState } from './use-ui-state'
import type {
  EditingCell,
  FieldMetaMap,
  SaveStatus,
  SaveTarget,
} from '../../hooks/use-inline-editing'
import type { DetectedConflict } from '../../hooks/use-realtime-reconciliation'
import type { RealtimeConnectionState } from '../../hooks/use-realtime-subscription'
import type { TableRecord } from '../../shared/types'
import type { InlineAutoSave } from '../body'
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
  readonly selectedCount: number
  readonly showSearch: boolean
  readonly editingCell?: EditingCell
  readonly autoSave?: InlineAutoSave
  readonly saveError?: string
  readonly saveStatus?: SaveStatus
  readonly saveTarget?: SaveTarget
  readonly saveIndicator?: SaveIndicatorSettings
  readonly onCellDoubleClick: (rowId: string | number, field: string, currentValue: unknown) => void
  readonly onEditSave: (newValue: unknown) => Promise<void>
  readonly onEditCancel: () => void
  readonly onRefresh: () => void
  readonly onToggleDensity: () => void
  readonly onBulkExecute: (action: DataTableBulkAction) => void
  readonly conflict?: DetectedConflict
  readonly onDismissConflict?: () => void
  readonly connectionStatus?: RealtimeConnectionState
  readonly ui: ReturnType<typeof useDataTableUiState>
}

export function DataTableView({
  containerRef,
  table,
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
  selectedCount,
  showSearch,
  editingCell,
  autoSave,
  saveError,
  saveStatus,
  saveTarget,
  saveIndicator,
  onCellDoubleClick,
  onEditSave,
  onEditCancel,
  onRefresh,
  onToggleDensity,
  onBulkExecute,
  conflict,
  onDismissConflict,
  connectionStatus,
  ui,
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
          <div className="border-border bg-bg-overlay rounded-md border px-3 py-2 shadow-lg">
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
          columnsMenuOpen={ui.columnsMenuOpen}
          onToggleColumnsMenu={ui.onToggleColumnsMenu}
          exportMenuOpen={ui.exportMenuOpen}
          onToggleExportMenu={ui.onToggleExportMenu}
          onCloseExportMenu={ui.onCloseExportMenu}
          onRefresh={onRefresh}
          onToggleDensity={onToggleDensity}
          activeFilter={ui.activeFilter}
          selectedCount={selectedCount}
          showSearch={showSearch}
          saveStatus={showToolbarIndicator ? indicatorStatus : undefined}
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
          table={table}
          records={records}
          tableFields={tableFields}
          filterStep={ui.filterStep}
          filterField={ui.filterField}
          onFieldSelect={ui.onFieldSelect}
          onValueSelect={ui.onValueSelect}
        />
      )}
      {!ui.importDialogOpen && !ui.filterOverlayOpen && (
        <TableContent
          table={table}
          records={records}
          allColumns={allColumns}
          isLoading={isLoading}
          striped={striped}
          currentRowHeight={currentRowHeight}
          cellClass={cellClass}
          borderClass={borderClass}
          emptyMessage={emptyMessage}
          selectionMode={selectionConfig?.mode}
          groupByConfig={groupByConfig}
          summaryConfig={summaryConfig}
          editingCell={editingCell}
          fieldMeta={fieldMeta}
          tableName={tableName}
          autoSave={autoSave}
          inlineSaveStatus={inlineSaveStatus}
          onCellDoubleClick={onCellDoubleClick}
          onEditSave={onEditSave}
          onEditCancel={onEditCancel}
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
