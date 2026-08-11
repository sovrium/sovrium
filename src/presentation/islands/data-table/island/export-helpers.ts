/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../../shared/types'
import type { useReactTable } from '@tanstack/react-table'

export interface ActiveFilter {
  readonly field: string
  readonly value: string
}

/**
 * Visible-column id helpers used by the columns menu, the export menu, and
 * the export-selected button. Kept out of the JSX-bearing files so that the
 * `react-refresh/only-export-components` rule (which forbids mixing helper
 * exports with component exports) stays satisfied.
 */

export function getVisibleColumnIds(
  table: ReturnType<typeof useReactTable<TableRecord>>
): readonly string[] {
  return table
    .getAllColumns()
    .filter((col) => col.id !== 'select' && col.getIsVisible())
    .map((col) => col.id)
}

export function getNonSelectColumnCount(
  table: ReturnType<typeof useReactTable<TableRecord>>
): number {
  return table.getAllColumns().filter((col) => col.id !== 'select').length
}

function buildFilterParam(activeFilter: ActiveFilter | undefined): string {
  return activeFilter
    ? `&filterField=${encodeURIComponent(activeFilter.field)}&filterValue=${encodeURIComponent(activeFilter.value)}`
    : ''
}

export function buildCsvExportHref(
  tableName: string,
  table: ReturnType<typeof useReactTable<TableRecord>>,
  activeFilter: ActiveFilter | undefined
): string {
  const visibleCols = getVisibleColumnIds(table)
  const hasHidden = visibleCols.length < getNonSelectColumnCount(table)
  const fieldsParam = hasHidden ? `&fields=${visibleCols.map(encodeURIComponent).join(',')}` : ''
  return `/api/tables/${tableName}/export?format=csv${buildFilterParam(activeFilter)}${fieldsParam}`
}

export function buildJsonExportHref(
  tableName: string,
  activeFilter: ActiveFilter | undefined
): string {
  return `/api/tables/${tableName}/export?format=json${buildFilterParam(activeFilter)}`
}
