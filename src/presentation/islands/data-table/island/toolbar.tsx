/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useState } from 'react'
import { SaveStatusIndicator } from '../save-status-indicator'
import { getNonSelectColumnCount, getVisibleColumnIds, type ActiveFilter } from './export-helpers'
import { ColumnsMenu, ExportMenu } from './toolbar-menus'
import type { SaveStatus } from '../../hooks/use-inline-editing'
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
      className="w-full max-w-sm rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
      aria-label={search.placeholder ?? 'Search'}
    />
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
  readonly columnsMenuOpen: boolean
  readonly onToggleColumnsMenu: () => void
  readonly exportMenuOpen: boolean
  readonly onToggleExportMenu: () => void
  readonly onCloseExportMenu: () => void
  readonly onRefresh: () => void
  readonly onToggleDensity: () => void
  readonly activeFilter: ActiveFilter | undefined
  readonly selectedCount: number
  readonly showSearch: boolean
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
  columnsMenuOpen,
  onToggleColumnsMenu,
  exportMenuOpen,
  onToggleExportMenu,
  onCloseExportMenu,
  onRefresh,
  onToggleDensity,
  activeFilter,
  selectedCount,
  showSearch,
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
      className="flex items-center gap-2 border-b border-gray-200 p-3"
    >
      {showSearch && searchConfig && (
        <SearchToolbar
          search={searchConfig}
          value={globalFilter}
          onChange={setGlobalFilter}
        />
      )}
      {saveStatus && saveStatus !== 'idle' && <SaveStatusIndicator status={saveStatus} />}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          onClick={onOpenImportDialog}
        >
          Import
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          aria-label="Filter"
          onClick={onOpenFilterOverlay}
        >
          Filter
        </button>
        <div className="relative">
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
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
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Export selected"
            disabled={selectedCount === 0}
            onClick={onExportSelectedClick}
          >
            Export selected
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
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
        {toolbarConfig?.refresh && (
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            aria-label="Refresh"
            onClick={onRefresh}
          >
            Refresh
          </button>
        )}
        {toolbarConfig?.density && (
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
            aria-label="Density"
            onClick={onToggleDensity}
          >
            Density
          </button>
        )}
      </div>
    </div>
  )
}
