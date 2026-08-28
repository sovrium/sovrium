/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ImportCsvDialog } from '../import-csv-dialog'
import { SaveStatusIndicator } from '../save-status-indicator'
import { AlternateView } from './alternate-view'
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
import { isAlternateView, type useDataTableUiState } from './use-ui-state'
import type { SaveIndicatorSettings } from './use-island-setup'
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
import type { CellCommit, DataTableRowClickAction, InlineAutoSave } from '../body'
import type { SummaryAggregations } from '../summary-aggregate'
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableGroupBy,
  DataTablePagination,
  ComponentSearch,
  DataTableSelection,
  DataTableSummaryItem,
  DataTableToolbar,
  DataTableKanbanGroupBy,
  DataTableViewLabels,
  DataTableViewType,
} from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import type { ColumnDef, useReactTable } from '@tanstack/react-table'

interface DataTableViewProps {
  /** Ref attached to the table container — wires clipboard copy interaction. */
  readonly containerRef?: React.Ref<HTMLDivElement>
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
  /** Accessible name for the `role="grid"` table (optional). */
  readonly ariaLabel?: string
  readonly tableName: string
  readonly allColumns: readonly ColumnDef<TableRecord>[]
  readonly totalRecords: number
  readonly isLoading: boolean
  readonly searchConfig?: ComponentSearch
  readonly selectionConfig?: DataTableSelection
  readonly toolbarConfig?: DataTableToolbar
  readonly bulkActionsConfig?: readonly DataTableBulkAction[]
  readonly paginationConfig?: DataTablePagination
  readonly groupByConfig?: DataTableGroupBy
  /** Whole-view record count per group value backing the group headers. */
  readonly groupCounts?: Readonly<Record<string, number>>
  /** Whole-view aggregations per group value backing the per-group summaries. */
  readonly groupAggregations?: Readonly<Record<string, SummaryAggregations>>
  readonly summaryConfig?: readonly DataTableSummaryItem[]
  /** Whole-view aggregates backing the summary footer (server-computed). */
  readonly summaryAggregations?: SummaryAggregations
  /** Column configuration — the footer reads each summarised column's `format`. */
  readonly columnConfig?: readonly DataTableColumn[]
  readonly tableFields?: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly globalFilter: string
  readonly setGlobalFilter: (value: string) => void
  readonly striped: boolean
  /**
   * Field whose declared option colours fill each row, plus the resolved
   * `optionValue → #RRGGBB` map — the grid's spelling of the record views'
   * `colorField`. Both absent on a grid that declares none.
   */
  readonly rowColorField?: string
  readonly rowColorFieldColors?: Readonly<Record<string, string>>
  readonly currentRowHeight: string
  readonly cellClass: string
  readonly borderClass: string
  readonly emptyMessage: string
  /**
   * Message rendered (in an `aria-live` `role="status"` region) when a
   * client-side search reduced a NON-empty dataset to zero rows — the no-match
   * state, distinct from `emptyMessage`. A `{query}` token echoes the active
   * search. Falls back to `emptyMessage` when omitted.
   */
  readonly noMatchMessage?: string
  readonly selectedCount: number
  readonly showSearch: boolean
  readonly editingCell?: EditingCell
  readonly autoSave?: InlineAutoSave
  readonly saveError?: string
  /** Current lifecycle of the most recent inline save. */
  readonly saveStatus?: SaveStatus
  /** The cell the {@link saveStatus} is reporting on. */
  readonly saveTarget?: SaveTarget
  /** Resolved save-indicator visibility + position; undefined when no auto-save. */
  readonly saveIndicator?: SaveIndicatorSettings
  /** Schema-driven row-click action (currently navigate only). */
  readonly onRowClickAction?: DataTableRowClickAction
  readonly onCellDoubleClick: (rowId: string | number, field: string, currentValue: unknown) => void
  readonly onEditSave: (newValue: unknown) => Promise<void>
  readonly onEditCancel: () => void
  /** Persists a single-gesture cell (checkbox / rating) without entering edit mode. */
  readonly onCellCommit: CellCommit
  readonly onRefresh: () => void
  /**
   * Toolbar create flow. `canCreate` gates the
   * primary "Nouvel enregistrement" button (absent — not disabled — when the
   * role may not create). `creating` drives the create modal; `onCreate` opens
   * it, `onCancelCreate` closes it, `onSubmitCreate` POSTs the filled fields.
   */
  readonly canCreate: boolean
  /**
   * Interpreter-provided create-record label, resolved server-side
   * against the active language. Labels the toolbar create button and the create
   * modal's title/aria-label so they localize to the app language.
   */
  readonly newRecordLabel: string
  /** Interpreter-provided create-dialog footer labels (same resolution). */
  readonly saveLabel: string
  readonly cancelLabel: string
  readonly creating: boolean
  readonly onCreate: () => void
  readonly onCancelCreate: () => void
  readonly onSubmitCreate: (values: Record<string, string>) => void
  /**
   * Read-only system-source grid:
   * the rows come from a read endpoint, not a DB table. When true, the
   * DB-table-only write affordances (CSV import, create) are gated OFF and the
   * grid keeps its native `<table>` role + accessible name (so a named runs
   * directory resolves via `getByRole('table', { name })`) rather than the
   * editable-grid `role="grid"` used by the record-drawer surface.
   */
  readonly readOnly?: boolean
  /**
   * System read-endpoint (`dataSource.system.endpoint`) for the CSV export. When
   * present (a read-only system source) AND `toolbar.export` is enabled, the
   * toolbar renders an "Exporter" affordance that navigates the browser to
   * `{endpoint}?format=csv` instead of the DB-table records-export dropdown.
   */
  readonly systemExportEndpoint?: string
  readonly currentDensity: RowDensity
  readonly onSelectDensity: (density: RowDensity) => void
  readonly onResetPreferences?: () => void
  readonly activeViewName?: string
  readonly onBulkExecute: (action: DataTableBulkAction) => void
  /** Realtime conflict surfaced when a concurrent edit overwrote displayed values. */
  readonly conflict?: DetectedConflict
  /** Dismisses the active realtime conflict toast. */
  readonly onDismissConflict?: () => void
  /**
   * Logical realtime transport connectivity.
   * Undefined when the data source is not in `realtime` refresh mode.
   */
  readonly connectionStatus?: RealtimeConnectionState
  readonly ui: ReturnType<typeof useDataTableUiState>
  /**
   * Saved-views surface (PG-03 / [internal ref]..022). The orchestrator
   * resolves these from `useSavedViews` + the schema's `app.tables[i].views[]`
   * and hands the merged shape down for the toolbar's Views menu + dialogs.
   */
  readonly viewsEnabled: boolean
  readonly viewEntries: ReadonlyArray<ViewsMenuEntry>
  readonly canSaveCurrentView: boolean
  readonly isViewModified: boolean
  readonly onSelectView: (entry: ViewsMenuEntry) => void
  readonly onSaveNewView: (name: string) => Promise<void>
  readonly onSaveModifiedView: () => void
  readonly onConfirmDeleteView: () => Promise<void>
  /**
   * View-type switcher config. `views` is
   * the ordered set the toolbar offers; the two per-view bindings are what the
   * non-grid views need to render, and validation guarantees each is present
   * whenever its view type is listed.
   */
  readonly views: readonly DataTableViewType[]
  readonly viewLabels?: DataTableViewLabels
  readonly kanbanGroupBy?: DataTableKanbanGroupBy
  readonly dateField?: string
}

/**
 * The JSX presenter for the data-table island.
 *
 * Pure rendering: takes the wired-up TanStack Table instance + UI state and
 * lays out the toolbar / bulk-action bar / filter overlay / table body /
 * pagination / import dialog. Extracted from the orchestrator so the
 * orchestrator's cyclomatic complexity stays under the size cap.
 */
export function DataTableView({
  containerRef,
  table,
  ariaLabel,
  tableName,
  allColumns,
  totalRecords,
  isLoading,
  searchConfig,
  selectionConfig,
  toolbarConfig,
  bulkActionsConfig,
  paginationConfig,
  groupByConfig,
  groupCounts,
  groupAggregations,
  summaryConfig,
  summaryAggregations,
  columnConfig,
  tableFields,
  fieldMeta,
  globalFilter,
  setGlobalFilter,
  striped,
  rowColorField,
  rowColorFieldColors,
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
  onCellCommit,
  onRefresh,
  canCreate,
  newRecordLabel,
  saveLabel,
  cancelLabel,
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
  views,
  viewLabels,
  kanbanGroupBy,
  dateField,
}: DataTableViewProps) {
  // Export is built-in native behavior — toolbar always shown
  const showToolbar = true

  // The grid and the alternate views are mutually exclusive: a switch REPLACES
  // the table rather than rendering a second surface beside it. Pagination
  // belongs to the grid, so it goes with it.
  const showGrid = !isAlternateView(ui.activeView)

  // Resolve where the save status indicator renders.
  const indicatorOn = saveIndicator?.show === true
  const indicatorStatus: SaveStatus = saveStatus ?? 'idle'
  const inlineSaveStatus =
    indicatorOn && saveIndicator?.position === 'inline' ? indicatorStatus : undefined
  const showToolbarIndicator = indicatorOn && saveIndicator?.position === 'toolbar'
  const showToastIndicator = indicatorOn && saveIndicator?.position === 'toast'
  // `saveTarget` is read here to keep its plumbing live for future
  // inline-positioning refinements; the inline indicator currently renders in
  // whichever cell is being edited (the only cell that can have a save).
  void saveTarget

  return (
    <div
      ref={containerRef}
      // Chrome-less: the surface tokens (`bg-background-raised`, `border-border`,
      // rounding, border) live on the `[data-component="data-table"]` island
      // host (see island-data-components.tsx), which this view is rendered
      // INTO via `createRoot`. Repeating the chrome here would double the
      // border. The host owns the visible surface; this view owns layout only.
      className="w-full overflow-hidden"
      // Realtime transport connectivity: exposes the
      // logical connection state (connected/reconnecting/disconnected) so a
      // page section can render a connection indicator. Absent when the data
      // source is not in `realtime` refresh mode.
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
          views={views}
          {...(viewLabels && { viewLabels })}
          onSelectViewType={ui.onSelectViewType}
          // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- `tableFields ?? []` returns the prop ref unchanged when defined; the empty-fallback path only fires for degenerate tables.
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
          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- closure passes the entry's id/name to the orchestrator; stable across renders is unnecessary because the toolbar re-creates the ViewsMenu on each open
          onDeleteView={(entry) => ui.onOpenDeleteViewDialog({ id: entry.id, name: entry.name })}
          onSaveModifiedView={onSaveModifiedView}
          saveStatus={showToolbarIndicator ? indicatorStatus : undefined}
        />
      )}
      {creating && (
        <CreateRecordDialog
          // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- `tableFields ?? []` returns the prop ref unchanged when defined; the empty-fallback path only fires for degenerate tables, and the dialog only mounts while `creating`.
          fields={tableFields ?? []}
          {...(fieldMeta && { fieldMeta })}
          title={newRecordLabel}
          saveLabel={saveLabel}
          cancelLabel={cancelLabel}
          onCancel={onCancelCreate}
          onSubmit={onSubmitCreate}
        />
      )}
      <SaveViewDialog
        open={ui.saveViewDialogOpen}
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- adapter closure bridges the dialog's `onOpenChange(boolean)` to the orchestrator's split open/close callbacks; the dialog re-renders only on `saveViewDialogOpen` flips, so the closure churn is bounded
        onOpenChange={(o) => (o ? ui.onOpenSaveViewDialog() : ui.onCloseSaveViewDialog())}
        onSave={onSaveNewView}
      />
      {ui.deleteViewTarget && (
        <DeleteViewConfirmDialog
          open={ui.deleteViewTarget !== null}
          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- adapter closure for `onOpenChange(boolean)` → orchestrator's `onCloseDeleteViewDialog`. The dialog is only mounted while `deleteViewTarget !== null`, so re-renders are bounded.
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
          // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- `tableFields ?? []` returns the prop ref unchanged when defined; the empty-fallback path only fires when there are no fields at all (degenerate case)
          tableFields={tableFields ?? []}
          fieldMeta={fieldMeta}
          activeFilters={ui.activeFilters}
          filterConjunction={ui.filterConjunction}
          onAddFilter={ui.addFilter}
          onRemoveFilter={ui.removeFilter}
          onClearAll={ui.clearAllFilters}
          onToggleConjunction={ui.toggleConjunction}
          onClose={ui.onCloseFilterOverlay}
        />
      )}
      {!ui.importDialogOpen && ui.sortOverlayOpen && (
        <SortOverlay
          // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- same rationale as the FilterOverlay fallback: the prop ref is unchanged when defined, the empty-fallback path only fires for degenerate tables.
          tableFields={tableFields ?? []}
          activeSorts={ui.activeSorts}
          onAddSort={ui.addSort}
          onRemoveSort={ui.removeSort}
          onClearAll={ui.clearAllSorts}
          onReorderSort={ui.reorderSort}
        />
      )}
      {/* `isAlternateView` rather than `!showGrid`: the two are the same test,
          but only the type guard narrows `activeView` to the non-grid literals
          `AlternateView` accepts. Spelling both invited the reading that they
          could disagree. */}
      {!ui.importDialogOpen && isAlternateView(ui.activeView) && (
        <AlternateView
          activeView={ui.activeView}
          // The grid's OWN post-filter rows — the client-side search / filter
          // narrowing carries across the switch instead of the view re-querying
          // the whole table.
          records={table.getFilteredRowModel().rows.map((row) => row.original)}
          {...(kanbanGroupBy && { kanbanGroupBy })}
          {...(dateField !== undefined && { dateField })}
          emptyMessage={emptyMessage}
        />
      )}
      {!ui.importDialogOpen && showGrid && (
        <TableContent
          table={table}
          {...(ariaLabel && { ariaLabel })}
          useGridRole={!readOnly}
          allColumns={allColumns}
          isLoading={isLoading}
          striped={striped}
          rowColorField={rowColorField}
          rowColorFieldColors={rowColorFieldColors}
          currentRowHeight={currentRowHeight}
          cellClass={cellClass}
          borderClass={borderClass}
          emptyMessage={emptyMessage}
          {...(noMatchMessage !== undefined && { noMatchMessage })}
          globalFilter={globalFilter}
          selectionMode={selectionConfig?.mode}
          groupByConfig={groupByConfig}
          {...(groupCounts && { groupCounts })}
          groupAggregations={groupAggregations}
          summaryConfig={summaryConfig}
          summaryAggregations={summaryAggregations}
          columnConfig={columnConfig}
          editingCell={editingCell}
          fieldMeta={fieldMeta}
          tableName={tableName}
          autoSave={autoSave}
          inlineSaveStatus={inlineSaveStatus}
          onRowClickAction={onRowClickAction}
          onCellDoubleClick={onCellDoubleClick}
          onEditSave={onEditSave}
          onEditCancel={onEditCancel}
          onCellCommit={onCellCommit}
          collapsedGroups={ui.collapsedGroups}
          onToggleGroupCollapsed={ui.toggleGroupCollapsed}
        />
      )}
      {!ui.importDialogOpen && showGrid && paginationConfig && (
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
