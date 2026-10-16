/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import {
  TABLE_TOOLBAR_BUTTON_PART,
  computeTablePagerButtonClasses,
} from '@/presentation/design/table-default-classes'
import { saveBlob } from '../../runtime/save-blob'
import { buildSelectionCsvDownload, getVisibleColumnIds } from './export-helpers'
import { useGridString } from './grid-strings'
import type { DataTableInstance } from './table-features'

/** What the selection bar's export needs: the rows, and where they come from. */
export interface SelectionExportProps {
  readonly table: DataTableInstance
  readonly tableName: string
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
 * It sits on the selection, in the bottom bar's left half, because it acts on
 * the selection — and it is drawn only once something is checked.
 *
 * WHICH OF THE TWO PATHS RUNS is decided by the source, and the asymmetry is
 * the contract rather than an inconsistency:
 *
 *   - A DB table has a server that can re-read a selection, so the browser is
 *     navigated to `/api/tables/:t/export` with the ids. That reaches rows the
 *     client is not holding — a 50-row selection over a paged grid is served
 *     whole — and it formats each cell the way the column declares.
 *   - A SYSTEM source has no table, so `/api/tables//export` is not a route.
 *     Such a grid serialises the rows it already holds, with the raw values the
 *     read envelope carried, and saves them without reaching anything.
 */
export function ExportSelectedButton({
  table,
  tableName,
  systemExportEndpoint,
  selectedCount,
}: SelectionExportProps & { readonly selectedCount: number }) {
  const exportSelectedLabel = useGridString('datatable.exportSelected', 'Export selected')
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
    // The columns are always named: a grid declaring three columns holds only
    // those three, and the export must not fall back to every field of the table.
    const visibleCols = getVisibleColumnIds(table).filter((id) => !id.startsWith('__'))
    const fieldsParam =
      visibleCols.length > 0 ? `&fields=${visibleCols.map(encodeURIComponent).join(',')}` : ''
    const idsParam = `&recordIds=${selectedIds.map(encodeURIComponent).join(',')}`
    window.location.href = `/api/tables/${tableName}/export?format=csv${idsParam}${fieldsParam}`
  }, [table, tableName, systemExportEndpoint])

  return (
    <button
      type="button"
      {...TABLE_TOOLBAR_BUTTON_PART}
      className={computeTablePagerButtonClasses({ variant: 'outline' })}
      aria-label={exportSelectedLabel}
      disabled={selectedCount === 0}
      onClick={onExportSelectedClick}
    >
      {exportSelectedLabel}
    </button>
  )
}
