/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { computeTableToolbarButtonClasses } from '@/presentation/design/table-default-classes'
import { saveBlob } from '../../../runtime/save-blob'
import {
  buildSelectionCsvDownload,
  getNonSelectColumnCount,
  getVisibleColumnIds,
} from '../export-helpers'
import { ExportMenu } from '../toolbar-menus'
import type { DataTableInstance } from '../table-features'
import type { ActiveFilter } from '../use-ui-state'

interface ExportControlProps {
  /**
   * System read-endpoint. When present on a read-only source, the control is an
   * "Export" button navigating to `{endpoint}?format=csv`.
   */
  readonly systemExportEndpoint?: string
  readonly readOnly: boolean
  readonly tableName: string
  readonly table: DataTableInstance
  readonly activeFilter: ActiveFilter | undefined
  readonly exportMenuOpen: boolean
  readonly onToggleExportMenu: () => void
  readonly onCloseExportMenu: () => void
}

/**
 * The toolbar export affordance, rendered only where `toolbar.export` declares
 * it (the caller owns that gate).
 *
 * A read-only system source navigates the browser to the system endpoint's
 * `?format=csv` — the server's `Content-Disposition` drives the download. Every
 * other case keeps the DB-table records-export dropdown targeting
 * `/api/tables/:t/export`.
 *
 * The gate is what keeps those two apart. This control used to render on every
 * grid, and a system source that had NOT declared `export` fell through to the
 * DB-table branch with an empty table name — an "Export" menu pointing at
 * `/api/tables//export`, which 404s with an HTML error page. There is no
 * URL-building bug to fix underneath: not offering the control is the fix.
 */
export function ExportControl({
  systemExportEndpoint,
  readOnly,
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
    /* eslint-disable-next-line functional/immutable-data -- imperative navigation
       is required to fire the browser-native CSV download from a button click
       against the system read endpoint's export route */
    window.location.href = `${systemExportEndpoint}${separator}format=csv`
  }, [systemExportEndpoint])

  if (readOnly && systemExportEndpoint) {
    return (
      <button
        type="button"
        className={computeTableToolbarButtonClasses()}
        aria-label="Export"
        onClick={onSystemExportClick}
      >
        Export
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={computeTableToolbarButtonClasses({ active: exportMenuOpen })}
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

interface ExportSelectedButtonProps {
  readonly table: DataTableInstance
  readonly tableName: string
  readonly selectedCount: number
  /**
   * The system READ endpoint, when this grid is bound to one. Its presence is
   * what says there is no DB table behind the grid — see
   * {@link ExportSelectedButton}.
   */
  readonly systemExportEndpoint?: string
}

/**
 * Exports only the checked rows, and only the columns still on screen.
 *
 * The handler lives here rather than in the toolbar shell because it reads
 * nothing the shell owns: the row selection and the column visibility both
 * come off the table instance this button already receives.
 *
 * WHICH OF THE TWO PATHS RUNS is decided by the source, and the asymmetry is
 * the contract rather than an inconsistency:
 *
 *   - A DB table has a server that can re-read a selection, so the browser is
 *     navigated to `/api/tables/:t/export` with the ids. That reaches rows the
 *     client is not holding — a 50-row selection over a paged grid is served
 *     whole — and it formats each cell the way the column declares.
 *   - A SYSTEM source has no table, so `/api/tables//export` is not a route: it
 *     collapses to a 404 and the operator gets an error page instead of a file.
 *     Such a grid serialises the rows it already holds, with the raw values the
 *     read envelope carried, and saves them without reaching anything.
 */
export function ExportSelectedButton({
  table,
  tableName,
  selectedCount,
  systemExportEndpoint,
}: ExportSelectedButtonProps) {
  const onExportSelectedClick = useCallback(() => {
    if (systemExportEndpoint) {
      const { csv, filename } = buildSelectionCsvDownload(table, systemExportEndpoint, new Date())
      saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename)
      return
    }
    const selectedIds = table
      .getFilteredSelectedRowModel()
      .rows.map((row) => String(row.original['id'] ?? ''))
      .filter((id) => id !== '')
    if (selectedIds.length === 0) return
    const visibleCols = getVisibleColumnIds(table)
    const hasHidden = visibleCols.length < getNonSelectColumnCount(table)
    const fieldsParam = hasHidden ? `&fields=${visibleCols.map(encodeURIComponent).join(',')}` : ''
    const idsParam = `&recordIds=${selectedIds.map(encodeURIComponent).join(',')}`
    /* eslint-disable-next-line functional/immutable-data -- imperative
       navigation is required to fire the browser-native CSV download
       from a button click while still using the existing GET endpoint */
    window.location.href = `/api/tables/${tableName}/export?format=csv${idsParam}${fieldsParam}`
  }, [table, tableName, systemExportEndpoint])

  return (
    <button
      type="button"
      className={computeTableToolbarButtonClasses({ disabled: selectedCount === 0 })}
      aria-label="Export selected"
      disabled={selectedCount === 0}
      onClick={onExportSelectedClick}
    >
      Export selected
    </button>
  )
}
