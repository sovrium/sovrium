/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { useState } from 'react'
import type { RowHeight } from '@/domain/models/app/pages/components/data-table'

// ---------------------------------------------------------------------------
// Row height cycling
// ---------------------------------------------------------------------------

export const ROW_HEIGHT_CLASSES: Record<RowHeight, string> = {
  short: 'py-1 px-3 text-sm',
  medium: 'py-2 px-4',
  tall: 'py-4 px-4',
}

const ROW_HEIGHT_CYCLE: Record<RowHeight, RowHeight> = {
  short: 'medium',
  medium: 'tall',
  tall: 'short',
}

// ---------------------------------------------------------------------------
// Hook params
// ---------------------------------------------------------------------------

interface UseDataTableStateParams {
  readonly initialPageSize: number
  readonly initialRowHeight: RowHeight
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Manages local UI state for the data table (sorting, filters, pagination, row selection, density). */
export function useDataTableState(params: UseDataTableStateParams) {
  const { initialPageSize, initialRowHeight } = params

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [currentRowHeight, setCurrentRowHeight] = useState<RowHeight>(initialRowHeight)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  })

  const toggleDensity = () => {
    setCurrentRowHeight((prev) => ROW_HEIGHT_CYCLE[prev])
  }

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
    toggleDensity,
    pagination,
    setPagination,
  }
}
