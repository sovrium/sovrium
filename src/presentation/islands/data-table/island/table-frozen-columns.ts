/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRef } from 'react'
import { useFrozenOffsets } from '../frozen-columns'
import type { TableContentProps } from './table-content-types'
import type { DataTableGridColumn } from './table-features'

/**
 * The field name a visible leaf column stands for — the grid the summary footer
 * aligns against. Falls back to the column id for the generated columns
 * (selection checkbox, row number, action cluster), which no summary can name.
 */
export const columnFieldName = (column: DataTableGridColumn): string =>
  column.columnDef.meta?.field ?? column.id

/** Whether the author pinned this column (`columns[].frozen`). */
export const isFrozenColumn = (column: DataTableGridColumn): boolean =>
  column.columnDef.meta?.frozen === true

/**
 * The `<table>` ref and the measured sticky offsets its pinned (`frozen`)
 * columns need. Both the header and the body cells read the SAME offsets, which
 * is what keeps a frozen column reading as one column under horizontal scroll.
 */
export function useFrozenPinning(table: TableContentProps['table']) {
  const tableRef = useRef<HTMLTableElement>(null)
  // In column order — the order the offsets stack in.
  const frozenFields = table.getVisibleLeafColumns().filter(isFrozenColumn).map(columnFieldName)
  return { tableRef, frozenOffsets: useFrozenOffsets(tableRef, frozenFields) }
}
