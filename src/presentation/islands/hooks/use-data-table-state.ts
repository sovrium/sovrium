/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  type ColumnSizingState,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { computeTableCellClasses } from '@/presentation/design/table-default-classes'
import type { RowHeight } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * The class each row height paints on a BODY cell.
 *
 * It does not reach the HEADER: a header's padding is a fixed constant of the
 * design, in `computeTableHeaderCellClasses()`, so a `tall` grid grows its
 * rows without inflating the column labels above them.
 *
 * The map is threaded on to `build-setup-result.ts` as a plain string and
 * delegates each entry to the recipe, so the declared row height and the
 * paint cannot disagree.
 */
export const ROW_HEIGHT_CLASSES: Record<RowHeight, string> = {
  short: computeTableCellClasses({ rowHeight: 'short' }),
  medium: computeTableCellClasses({ rowHeight: 'medium' }),
  tall: computeTableCellClasses({ rowHeight: 'tall' }),
}

interface UseDataTableStateParams {
  readonly initialPageSize: number
  readonly initialRowHeight: RowHeight
}

/**
 * Manages local UI state for the data table (sorting, filters, pagination,
 * row selection, column widths). The row height is the author's declared one,
 * read once at mount; a reader's resizes last for the visit only.
 */
export function useDataTableState(params: UseDataTableStateParams) {
  const { initialPageSize, initialRowHeight } = params

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [currentRowHeight] = useState<RowHeight>(initialRowHeight)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  })

  return {
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    globalFilter,
    setGlobalFilter,
    rowSelection,
    setRowSelection,
    currentRowHeight,
    columnSizing,
    setColumnSizing,
    pagination,
    setPagination,
  }
}
