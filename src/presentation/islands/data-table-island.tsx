/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines-per-function, complexity -- Complex interactive table component, extraction done via sub-components */

import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { useState, useEffect } from 'react'
import { createRecordsClient } from '@/presentation/api/client'
import { TableBodyRows, TableHeader } from './data-table-body'
import { autoGenerateColumns, mapColumnsToColumnDefs } from './data-table-formatting'
import type { TableRecord } from './shared/types'
import type {
  DataTableColumn,
  DataTablePagination,
  DataTableSearch,
  DataTableSelection,
  DataTableToolbar,
  RowHeight,
} from '@/domain/models/app/page/common/data-table'

// ---------------------------------------------------------------------------
// Types and props
// ---------------------------------------------------------------------------

interface DataTableIslandProps {
  readonly dataSource: {
    readonly table: string
    /** TODO: Pass viewId to API query params when view-based filtering is implemented */
    readonly view?: string
  }
  readonly columns?: readonly DataTableColumn[]
  readonly pagination?: DataTablePagination
  readonly search?: DataTableSearch
  readonly selection?: DataTableSelection
  /** TODO: Implement toolbar features (search, filters, export, refresh, density, column toggle) */
  readonly toolbar?: DataTableToolbar
  readonly striped?: boolean
  readonly bordered?: boolean
  readonly emptyMessage?: string
  /** TODO: Implement row number column prepended to table */
  readonly showRowNumbers?: boolean
  readonly rowHeight?: RowHeight
  /** When set, only react to island:search events from this source ID */
  readonly searchSourceId?: string
}

interface FetchResult {
  readonly records: readonly TableRecord[]
  readonly total: number
}

// ---------------------------------------------------------------------------
// Data fetching (Hono RPC client)
// ---------------------------------------------------------------------------

const apiClient = createRecordsClient(typeof window !== 'undefined' ? window.location.origin : '')

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ROW_HEIGHT_CLASSES: Record<RowHeight, string> = {
  short: 'py-1 px-3 text-sm',
  medium: 'py-2 px-4',
  tall: 'py-4 px-4',
}

function SearchToolbar({
  search,
  value,
  onChange,
}: {
  readonly search: DataTableSearch
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  const [localValue, setLocalValue] = useState(value)
  const debounceMs = search.debounceMs ?? 300

  useEffect(() => {
    const timer = setTimeout(() => onChange(localValue), debounceMs)
    return () => clearTimeout(timer)
  }, [localValue, debounceMs, onChange])

  useEffect(() => setLocalValue(value), [value])

  return (
    <div className="border-b border-gray-200 p-3">
      <input
        type="search"
        placeholder={search.placeholder ?? 'Search...'}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="w-full max-w-sm rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        aria-label={search.placeholder ?? 'Search'}
      />
    </div>
  )
}

function PaginationControls({
  table,
  total,
}: {
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
  readonly total: number
}) {
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()

  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-2 py-3">
      <span className="text-sm text-gray-600">
        {total > 0
          ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, total)} of ${total}`
          : 'No results'}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          aria-label="Previous page"
        >
          Previous
        </button>
        <span className="text-sm">
          Page {pageIndex + 1} of {pageCount || 1}
        </span>
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column builder helpers
// ---------------------------------------------------------------------------

function buildSelectionColumn(mode?: string): ColumnDef<TableRecord> {
  return {
    id: 'select',
    header:
      mode === 'multiple'
        ? ({ table: t }) => (
            <input
              type="checkbox"
              checked={t.getIsAllRowsSelected()}
              onChange={t.getToggleAllRowsSelectedHandler()}
              aria-label="Select all rows"
            />
          )
        : '',
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
        aria-label={`Select row ${row.index + 1}`}
      />
    ),
    enableSorting: false,
    enableColumnFilter: false,
  }
}

function buildColumns(
  columnConfig: readonly DataTableColumn[] | undefined,
  records: readonly TableRecord[],
  selectionConfig: DataTableSelection | undefined
): ColumnDef<TableRecord>[] {
  const baseColumns =
    columnConfig && columnConfig.length > 0
      ? [...mapColumnsToColumnDefs(columnConfig)]
      : [...autoGenerateColumns(records)]

  const selectionEnabled =
    selectionConfig?.mode === 'single' || selectionConfig?.mode === 'multiple'

  return selectionEnabled
    ? [buildSelectionColumn(selectionConfig?.mode), ...baseColumns]
    : baseColumns
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DataTableIsland(props: DataTableIslandProps) {
  const {
    dataSource,
    columns: columnConfig,
    pagination: paginationConfig,
    search: searchConfig,
    selection: selectionConfig,
    striped = false,
    bordered = false,
    emptyMessage = 'No records found',
    rowHeight = 'medium',
    searchSourceId,
  } = props

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: paginationConfig?.pageSize ?? 25,
  })

  const sortParam =
    sorting.length > 0
      ? sorting.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',')
      : undefined

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['table-records', dataSource.table, pagination, sortParam, globalFilter],
    queryFn: async (): Promise<FetchResult> => {
      const query = {
        page: String(pagination.pageIndex + 1),
        ...(pagination.pageSize && { limit: String(pagination.pageSize) }),
        ...(sortParam && { sort: sortParam }),
        ...(globalFilter && { q: globalFilter }),
      }

      const res = await apiClient.api.tables[':tableId'].records.$get({
        param: { tableId: dataSource.table },
        query,
      })

      if (!res.ok) {
        const body = await res.text()
        // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
        throw new Error(`Failed to fetch records: ${res.status} ${body}`)
      }

      const json = (await res.json()) as {
        records?: readonly TableRecord[]
        total?: number
        pagination?: { total?: number }
      }
      return {
        records: json.records ?? [],
        total: json.total ?? json.pagination?.total ?? (json.records ?? []).length,
      }
    },
  })

  // Spread readonly→mutable array: TanStack Table v8 requires mutable TData[]
  const records = [...(data?.records ?? [])]
  const totalRecords = data?.total ?? 0
  const allColumns = buildColumns(columnConfig, records, selectionConfig)
  const selectionEnabled =
    selectionConfig?.mode === 'single' || selectionConfig?.mode === 'multiple'

  const table = useReactTable({
    data: records,
    columns: allColumns,
    state: { sorting, columnFilters, globalFilter, pagination, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: selectionEnabled,
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil(totalRecords / pagination.pageSize),
  })

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { query?: string; sourceId?: string } | undefined
      if (detail?.query === undefined) return
      // If searchSourceId is set, only accept events from matching source
      if (searchSourceId && detail.sourceId !== searchSourceId) return
      setGlobalFilter(detail.query)
    }
    document.addEventListener('island:search', handler)
    return () => document.removeEventListener('island:search', handler)
  }, [searchSourceId])

  const cellClass: string = ROW_HEIGHT_CLASSES[rowHeight]
  const borderClass = bordered ? 'border border-gray-200' : ''

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        Failed to load data: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    )
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
      {searchConfig && searchConfig.enabled !== false && (
        <SearchToolbar
          search={searchConfig}
          value={globalFilter}
          onChange={setGlobalFilter}
        />
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <TableHeader
            headerGroups={table.getHeaderGroups()}
            cellClass={cellClass}
          />
          <TableBodyRows
            rows={table.getRowModel().rows}
            allColumns={allColumns}
            isLoading={isLoading}
            cellClass={cellClass}
            borderClass={borderClass}
            striped={striped}
            emptyMessage={emptyMessage}
          />
        </table>
      </div>
      {paginationConfig && (
        <PaginationControls
          table={table}
          total={totalRecords}
        />
      )}
    </div>
  )
}
