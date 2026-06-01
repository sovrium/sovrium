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
import { useEffect, useState } from 'react'
import type { RowHeight } from '@/domain/models/app/pages/components/data-table'


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


interface UseDataTableStateParams {
  readonly initialPageSize: number
  readonly initialRowHeight: RowHeight
  readonly initialColumnSizing?: Record<string, number>
  readonly controlledColumnSizing?: Record<string, number>
  readonly controlledRowHeight?: RowHeight
}


export function useDataTableState(params: UseDataTableStateParams) {
  const {
    initialPageSize,
    initialRowHeight,
    initialColumnSizing,
    controlledColumnSizing,
    controlledRowHeight,
  } = params

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [internalRowHeight, setInternalRowHeight] = useState<RowHeight>(initialRowHeight)
  const [internalColumnSizing, setInternalColumnSizing] = useState<ColumnSizingState>(
    initialColumnSizing ?? {}
  )
  const columnSizing = controlledColumnSizing ?? internalColumnSizing
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  })

  const currentRowHeight = controlledRowHeight ?? internalRowHeight

  useEffect(() => {
    if (initialColumnSizing) setInternalColumnSizing(initialColumnSizing)
  }, [initialColumnSizing])

  const toggleDensity = () => {
    setInternalRowHeight((prev) => ROW_HEIGHT_CYCLE[prev])
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
    setCurrentRowHeight: setInternalRowHeight,
    toggleDensity,
    columnSizing,
    setColumnSizing: setInternalColumnSizing,
    pagination,
    setPagination,
  }
}
