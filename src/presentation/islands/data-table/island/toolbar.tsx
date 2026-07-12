/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useState } from 'react'
import { SaveStatusIndicator } from '../save-status-indicator'
import { DensityMenu } from './density-menu'
import { getNonSelectColumnCount, getVisibleColumnIds, type ActiveFilter } from './export-helpers'
import { GroupMenu } from './group-menu'
import { SettingsDialog } from './settings-dialog'
import { ColumnsMenu, ExportMenu } from './toolbar-menus'
import { DROPDOWN_TRIGGER_CLASS } from './use-dropdown-state'
import { ViewsMenu, type ViewsMenuEntry } from './views-menu'
import type { SaveStatus } from '../../hooks/use-inline-editing'
import type { RowDensity } from '../../hooks/use-table-preferences'
import type { TableRecord } from '../../shared/types'
import type {
  DataTableSearch,
  DataTableSelection,
  DataTableToolbar,
} from '@/domain/models/app/pages/components/data-table'
import type { useReactTable } from '@tanstack/react-table'


interface SearchToolbarProps {
  readonly search: DataTableSearch
  readonly value: string
  readonly onChange: (value: string) => void
}

export function SearchToolbar({ search, value, onChange }: SearchToolbarProps) {
  const [localValue, setLocalValue] = useState(value)
  const debounceMs = search.debounceMs ?? 300

  useEffect(() => {
    const timer = setTimeout(() => onChange(localValue), debounceMs)
    return () => clearTimeout(timer)
  }, [localValue, debounceMs, onChange])

  useEffect(() => setLocalValue(value), [value])

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setLocalValue(e.target.value),
    []
  )

  return (
    <input
      type="search"
      placeholder={search.placeholder ?? 'Search...'}
      value={localValue}
      onChange={onInputChange}
      className="border-border focus:border-primary focus:ring-focus-ring w-full max-w-sm rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
      aria-label={search.placeholder ?? 'Search'}
    />
  )
}


interface ExportControlProps {
  readonly systemExportEndpoint?: string
  readonly readOnly: boolean
  readonly showExport: boolean
  readonly tableName: string
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
  readonly activeFilter: ActiveFilter | undefined
  readonly exportMenuOpen: boolean
  readonly onToggleExportMenu: () => void
  readonly onCloseExportMenu: () => void
}

function ExportControl({
  systemExportEndpoint,
  readOnly,
  showExport,
  tableName,
  table,
  activeFilter,
  exportMenuOpen,
  onToggleExportMenu,
  onCloseExportMenu,
}: ExportControlProps) {
  const onSystemExportClick = useCallback(() => {
    if (!systemExportEndpoint) return
    const separator = systemExportEndpoint.includes('?') ? '&' : '?'
    window.location.href = `${systemExportEndpoint}${separator}format=csv`
  }, [systemExportEndpoint])

  if (readOnly && showExport && systemExportEndpoint) {
    return (
      <button
        type="button"
        className={DROPDOWN_TRIGGER_CLASS}
        aria-label="Exporter"
        onClick={onSystemExportClick}
      >
        Exporter
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={DROPDOWN_TRIGGER_CLASS}
        aria-label="Export"
        aria-haspopup="true"
        aria-expanded={exportMenuOpen}
        onClick={onToggleExportMenu}
      >
        Export
      </button>
      {exportMenuOpen && (
        <ExportMenu
          tableName={tableName}
          table={table}
          activeFilter={activeFilter}
          onClose={onCloseExportMenu}
        />
      )}
    </div>
  )
}


interface DataTableToolbarBarProps {
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
  readonly tableName: string
  readonly toolbarConfig?: DataTableToolbar
  readonly searchConfig?: DataTableSearch
  readonly selectionConfig?: DataTableSelection
  readonly globalFilter: string
  readonly setGlobalFilter: (value: string) => void
  readonly importDialogOpen: boolean
  readonly onOpenImportDialog: () => void
  readonly onOpenFilterOverlay: () => void
  readonly onOpenSortOverlay: () => void
  readonly activeSortCount: number
  readonly activeView: 'grid' | 'kanban'
  readonly onSelectGridView: () => void
  readonly onSelectKanbanView: () => void
  readonly groupableFields: ReadonlyArray<string>
  readonly runtimeGroupBy: string | null
  readonly onSelectRuntimeGroupBy: (field: string | null) => void
  readonly columnsMenuOpen: boolean
  readonly onToggleColumnsMenu: () => void
  readonly exportMenuOpen: boolean
  readonly onToggleExportMenu: () => void
  readonly onCloseExportMenu: () => void
  readonly onRefresh: () => void
  readonly canCreate: boolean
  readonly onCreate: () => void
  readonly readOnly?: boolean
  readonly systemExportEndpoint?: string
  readonly currentDensity: RowDensity
  readonly onSelectDensity: (density: RowDensity) => void
  readonly onResetPreferences?: () => void
  readonly activeViewName?: string
  readonly activeFilter: ActiveFilter | undefined
  readonly activeFilterCount: number
  readonly selectedCount: number
  readonly showSearch: boolean
  readonly viewsEnabled: boolean
  readonly viewEntries: ReadonlyArray<ViewsMenuEntry>
  readonly canSaveCurrentView: boolean
  readonly isViewModified: boolean
  readonly activeViewSource: 'developer' | 'personal' | null
  readonly onOpenSaveViewDialog: () => void
  readonly onSelectView: (entry: ViewsMenuEntry) => void
  readonly onDeleteView: (entry: ViewsMenuEntry) => void
  readonly onSaveModifiedView: () => void
  readonly saveStatus?: SaveStatus
}

export function DataTableToolbarBar({
  table,
  tableName,
  toolbarConfig,
  searchConfig,
  selectionConfig,
  globalFilter,
  setGlobalFilter,
  importDialogOpen,
  onOpenImportDialog,
  onOpenFilterOverlay,
  onOpenSortOverlay,
  activeSortCount,
  activeView,
  onSelectGridView,
  onSelectKanbanView,
  groupableFields,
  runtimeGroupBy,
  onSelectRuntimeGroupBy,
  columnsMenuOpen,
  onToggleColumnsMenu,
  exportMenuOpen,
  onToggleExportMenu,
  onCloseExportMenu,
  onRefresh,
  canCreate,
  onCreate,
  readOnly = false,
  systemExportEndpoint,
  currentDensity,
  onSelectDensity,
  onResetPreferences,
  activeViewName,
  activeFilter,
  activeFilterCount,
  selectedCount,
  showSearch,
  viewsEnabled,
  viewEntries,
  canSaveCurrentView,
  isViewModified,
  activeViewSource,
  onOpenSaveViewDialog,
  onSelectView,
  onDeleteView,
  onSaveModifiedView,
  saveStatus,
}: DataTableToolbarBarProps) {
  const onExportSelectedClick = useCallback(() => {
    const selectedIds = table
      .getFilteredSelectedRowModel()
      .rows.map((row) => String(row.original['id'] ?? ''))
      .filter((id) => id !== '')
    if (selectedIds.length === 0) return
    const visibleCols = getVisibleColumnIds(table)
    const hasHidden = visibleCols.length < getNonSelectColumnCount(table)
    const fieldsParam = hasHidden ? `&fields=${visibleCols.map(encodeURIComponent).join(',')}` : ''
    const idsParam = `&recordIds=${selectedIds.map(encodeURIComponent).join(',')}`
    window.location.href = `/api/tables/${tableName}/export?format=csv${idsParam}${fieldsParam}`
  }, [table, tableName])

  return (
    <div
      role="toolbar"
      data-toolbar
      data-testid="data-table-toolbar"
      aria-hidden={importDialogOpen || undefined}
      className="border-border flex items-center gap-2 border-b p-3"
    >
      {canCreate && (
        <button
          type="button"
          aria-label="Nouvel enregistrement"
          onClick={onCreate}
          className="bg-primary text-primary-foreground hover:bg-primary-hover rounded px-3 py-1 text-sm font-medium"
        >
          + Nouvel enregistrement
        </button>
      )}
      {showSearch && searchConfig && (
        <SearchToolbar
          search={searchConfig}
          value={globalFilter}
          onChange={setGlobalFilter}
        />
      )}
      {activeViewName && (
        <span
          data-testid="data-table-active-view"
          className="text-foreground-muted text-sm"
        >
          {activeViewName}
        </span>
      )}
      {toolbarConfig?.viewSwitcher && (
        <div
          data-testid="view-switcher"
          role="group"
          aria-label="View"
          className="inline-flex items-center gap-1"
        >
          <button
            type="button"
            aria-label="Grid"
            aria-pressed={activeView === 'grid'}
            onClick={onSelectGridView}
            className={`rounded border px-2 py-1 text-xs ${
              activeView === 'grid'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-background-subtle'
            }`}
          >
            Grid
          </button>
          <button
            type="button"
            aria-label="Kanban"
            aria-pressed={activeView === 'kanban'}
            onClick={onSelectKanbanView}
            className={`rounded border px-2 py-1 text-xs ${
              activeView === 'kanban'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-background-subtle'
            }`}
          >
            Kanban
          </button>
        </div>
      )}
      {saveStatus && saveStatus !== 'idle' && <SaveStatusIndicator status={saveStatus} />}
      <div className="ml-auto flex items-center gap-2">
        {!readOnly && (
          <button
            type="button"
            className={DROPDOWN_TRIGGER_CLASS}
            onClick={onOpenImportDialog}
          >
            Import
          </button>
        )}
        <button
          type="button"
          className="hover:bg-background-subtle inline-flex items-center gap-1 rounded border px-3 py-1 text-sm"
          aria-label="Filter"
          onClick={onOpenFilterOverlay}
        >
          Filter
          {activeFilterCount > 0 && (
            <span
              data-testid="filter-badge"
              className="bg-primary text-primary-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium"
            >
              {activeFilterCount}
            </span>
          )}
        </button>
        {toolbarConfig?.sort && (
          <button
            type="button"
            className="hover:bg-background-subtle inline-flex items-center gap-1 rounded border px-3 py-1 text-sm"
            aria-label="Sort"
            onClick={onOpenSortOverlay}
          >
            Sort
            {activeSortCount > 0 && (
              <span
                data-testid="sort-badge"
                className="bg-primary text-primary-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium"
              >
                {activeSortCount}
              </span>
            )}
          </button>
        )}
        {toolbarConfig?.groupBy && (
          <GroupMenu
            fields={groupableFields}
            current={runtimeGroupBy}
            onSelect={onSelectRuntimeGroupBy}
          />
        )}
        {viewsEnabled && (
          <>
            {}
            <button
              type="button"
              aria-label="Save view"
              disabled={!canSaveCurrentView}
              onClick={onOpenSaveViewDialog}
              className={`${DROPDOWN_TRIGGER_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Save view
            </button>
            <ViewsMenu
              views={viewEntries}
              onSelectView={onSelectView}
              onSaveCurrentView={onOpenSaveViewDialog}
              onDeleteView={onDeleteView}
            />
            {}
            {isViewModified && (
              <>
                <span
                  data-testid="view-modified-indicator"
                  className="text-foreground-muted text-xs italic"
                >
                  Modified
                </span>
                {activeViewSource === 'personal' && (
                  <button
                    type="button"
                    aria-label="Save"
                    onClick={onSaveModifiedView}
                    className={DROPDOWN_TRIGGER_CLASS}
                  >
                    Save
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Save as new"
                  onClick={onOpenSaveViewDialog}
                  className={DROPDOWN_TRIGGER_CLASS}
                >
                  Save as new
                </button>
              </>
            )}
          </>
        )}
        <div className="relative">
          <button
            type="button"
            className={DROPDOWN_TRIGGER_CLASS}
            aria-label="Columns"
            onClick={onToggleColumnsMenu}
          >
            Columns
          </button>
          {columnsMenuOpen && <ColumnsMenu table={table} />}
        </div>
        {selectionConfig?.mode === 'multiple' && (
          <button
            type="button"
            className={`${DROPDOWN_TRIGGER_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
            aria-label="Export selected"
            disabled={selectedCount === 0}
            onClick={onExportSelectedClick}
          >
            Export selected
          </button>
        )}
        <ExportControl
          {...(systemExportEndpoint !== undefined && { systemExportEndpoint })}
          readOnly={readOnly}
          showExport={toolbarConfig?.export === true}
          tableName={tableName}
          table={table}
          activeFilter={activeFilter}
          exportMenuOpen={exportMenuOpen}
          onToggleExportMenu={onToggleExportMenu}
          onCloseExportMenu={onCloseExportMenu}
        />
        {toolbarConfig?.refresh && (
          <button
            type="button"
            className={DROPDOWN_TRIGGER_CLASS}
            aria-label="Refresh"
            onClick={onRefresh}
          >
            Refresh
          </button>
        )}
        {toolbarConfig?.density && (
          <DensityMenu
            current={currentDensity}
            onSelect={onSelectDensity}
          />
        )}
        {onResetPreferences && <SettingsDialog onReset={onResetPreferences} />}
      </div>
    </div>
  )
}
