/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ImportCsvDialog } from '../import-csv-dialog'
import { BulkActionBar } from './bulk-actions'
import { FilterOverlay } from './filter-overlay'
import { PaginationControls } from './pagination'
import { TableContent } from './table-content'
import { DataTableToolbarBar, SearchToolbar } from './toolbar'
import type { useDataTableUiState } from './use-ui-state'
import type { EditingCell, FieldMetaMap } from '../../hooks/use-inline-editing'
import type { TableRecord } from '../../shared/types'
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
  readonly onCellDoubleClick: (rowId: string | number, field: string, currentValue: unknown) => void
  readonly onEditSave: (newValue: unknown) => Promise<void>
  readonly onEditCancel: () => void
  readonly onRefresh: () => void
  readonly onToggleDensity: () => void
  readonly onBulkExecute: (action: DataTableBulkAction) => void
  readonly ui: ReturnType<typeof useDataTableUiState>
}

/**
 * The JSX presenter for the data-table island.
 *
 * Pure rendering: takes the wired-up TanStack Table instance + UI state and
 * lays out the toolbar / bulk-action bar / filter overlay / table body /
 * pagination / import dialog. Extracted from the orchestrator so the
 * orchestrator's cyclomatic complexity stays under the size cap.
 */
// eslint-disable-next-line max-lines-per-function, complexity -- view layer with ~7 conditional render branches (toolbar/search/bulk-actions/filter-overlay/table-content/pagination/import-dialog); further splits would scatter the table's render contract across files
export function DataTableView({
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
  onCellDoubleClick,
  onEditSave,
  onEditCancel,
  onRefresh,
  onToggleDensity,
  onBulkExecute,
  ui,
}: DataTableViewProps) {
  // Export is built-in native behavior — toolbar always shown
  const showToolbar = true

  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
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
        />
      )}
      {!showToolbar && showSearch && searchConfig && (
        <div className="border-b border-gray-200 p-3">
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
