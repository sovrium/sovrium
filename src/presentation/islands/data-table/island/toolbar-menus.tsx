/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildCsvExportHref, buildJsonExportHref, type ActiveFilter } from './export-helpers'
import type { TableRecord } from '../../shared/types'
import type { useReactTable } from '@tanstack/react-table'


export function ColumnsMenu({
  table,
}: {
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
}) {
  return (
    <div
      role="menu"
      data-testid="column-toggle-panel"
      className="border-border bg-background-overlay absolute top-full right-0 z-10 mt-1 min-w-max rounded border p-2 shadow-lg"
    >
      {table
        .getAllColumns()
        .filter((col) => col.id !== 'select')
        .map((col) => (
          <label
            key={col.id}
            className="hover:bg-background-subtle flex cursor-pointer items-center gap-2 px-2 py-1 text-sm"
          >
            {}
            <input
              type="checkbox"
              role="switch"
              checked={col.getIsVisible()}
              onChange={col.getToggleVisibilityHandler()}
              aria-label={col.id}
              aria-checked={col.getIsVisible()}
            />
            {col.id}
          </label>
        ))}
    </div>
  )
}


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
      className="border-border bg-background-overlay absolute top-full right-0 z-10 mt-1 rounded border shadow-lg"
    >
      <a
        href={buildCsvExportHref(tableName, table, activeFilter)}
        download
        role="menuitem"
        className="hover:bg-background-subtle block w-full px-4 py-2 text-left text-sm"
        onClick={onClose}
      >
        Export as CSV
      </a>
      <a
        href={buildJsonExportHref(tableName, activeFilter)}
        download
        role="menuitem"
        className="hover:bg-background-subtle block w-full px-4 py-2 text-left text-sm"
        onClick={onClose}
      >
        Export as JSON
      </a>
    </div>
  )
}
