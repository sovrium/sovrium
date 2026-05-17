/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildCsvExportHref, buildJsonExportHref, type ActiveFilter } from './export-helpers'
import type { TableRecord } from '../../shared/types'
import type { useReactTable } from '@tanstack/react-table'

// ---------------------------------------------------------------------------
// ColumnsMenu
// ---------------------------------------------------------------------------

export function ColumnsMenu({
  table,
}: {
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
}) {
  return (
    <div
      role="menu"
      className="absolute top-full right-0 z-10 mt-1 min-w-max rounded border bg-white p-2 shadow-lg"
    >
      {table
        .getAllColumns()
        .filter((col) => col.id !== 'select')
        .map((col) => (
          <label
            key={col.id}
            className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={col.getIsVisible()}
              onChange={col.getToggleVisibilityHandler()}
              aria-label={col.id}
            />
            {col.id}
          </label>
        ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExportMenu (CSV/JSON dropdown)
// ---------------------------------------------------------------------------

export function ExportMenu({
  tableName,
  table,
  activeFilter,
  onClose,
}: {
  readonly tableName: string
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
  readonly activeFilter: ActiveFilter | undefined
  readonly onClose: () => void
}) {
  return (
    <div
      role="menu"
      className="absolute top-full right-0 z-10 mt-1 rounded border bg-white shadow-lg"
    >
      <a
        href={buildCsvExportHref(tableName, table, activeFilter)}
        download
        role="menuitem"
        className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
        onClick={onClose}
      >
        Export as CSV
      </a>
      <a
        href={buildJsonExportHref(tableName, activeFilter)}
        download
        role="menuitem"
        className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
        onClick={onClose}
      >
        Export as JSON
      </a>
    </div>
  )
}
