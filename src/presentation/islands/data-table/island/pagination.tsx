/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import type { TableRecord } from '../../shared/types'
import type { useReactTable } from '@tanstack/react-table'

interface PaginationControlsProps {
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
  readonly total: number
  readonly pageSizeOptions?: readonly number[]
}

function PageSizeSelect({
  pageSize,
  pageSizeOptions,
  onChange,
}: {
  readonly pageSize: number
  readonly pageSizeOptions: readonly number[]
  readonly onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}) {
  return (
    <select
      data-page-size
      value={pageSize}
      onChange={onChange}
      className="rounded border px-2 py-1 text-sm"
      aria-label="Page size"
    >
      {pageSizeOptions.map((size) => (
        <option
          key={size}
          value={size}
        >
          {size} / page
        </option>
      ))}
    </select>
  )
}

export function PaginationControls({ table, total, pageSizeOptions }: PaginationControlsProps) {
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = table.getPageCount()

  const onPageSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => table.setPageSize(Number(e.target.value)),
    [table]
  )
  const onPrevious = useCallback(() => table.previousPage(), [table])
  const onNext = useCallback(() => table.nextPage(), [table])

  const summary =
    total > 0
      ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, total)} of ${total}`
      : 'No results'

  return (
    <nav
      aria-label="pagination"
      data-pagination
      className="border-border flex items-center justify-between border-t px-2 py-3"
    >
      <span className="text-fg-muted text-sm">{summary}</span>
      <div className="flex items-center gap-2">
        {pageSizeOptions && pageSizeOptions.length > 0 && (
          <PageSizeSelect
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            onChange={onPageSizeChange}
          />
        )}
        <button
          type="button"
          onClick={onPrevious}
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
          onClick={onNext}
          disabled={!table.getCanNextPage()}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </nav>
  )
}
