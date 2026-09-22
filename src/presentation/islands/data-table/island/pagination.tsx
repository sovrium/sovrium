/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import {
  computeTablePagerButtonClasses,
  computeTablePagerClasses,
  computeTablePagerSelectClasses,
} from '@/presentation/design/table-default-classes'
import type { DataTableInstance } from './table-features'

interface PaginationControlsProps {
  readonly table: DataTableInstance
  readonly total: number
  readonly pageSizeOptions?: readonly number[]
  /**
   * Which edge of the grid this pager sits on. It decides the separating border
   * only — a pager above the rows is bordered underneath, one below is bordered
   * on top — so the rule always falls between the pager and the rows it counts.
   * WHERE the pager is placed is `GridBody`'s call, not this one's.
   */
  readonly position?: 'top' | 'bottom'
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
      className={computeTablePagerSelectClasses()}
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

/**
 * The page-number pager.
 *
 * Two placement decisions stay at this call site rather than moving into the
 * pager recipe, because both are properties of what this bar HOLDS rather than
 * of the bar. `justify-between` pushes the range summary and the step controls
 * to opposite edges — the same chrome carries a single centred button under a
 * cursor-paginated feed, where that would be wrong. And the summary span
 * declares no type of its own: the bar's 11px muted step IS the pager's voice,
 * and the span used to override it one step LOUDER than the values it counts.
 */
export function PaginationControls(props: PaginationControlsProps) {
  const { table, total, pageSizeOptions, position = 'bottom' } = props
  const { pageIndex, pageSize } = table.state.pagination
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
      className={`${computeTablePagerClasses({ position })} justify-between`}
    >
      <span>{summary}</span>
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
          className={computeTablePagerButtonClasses({ disabled: !table.getCanPreviousPage() })}
          aria-label="Previous page"
        >
          Previous
        </button>
        <span>
          Page {pageIndex + 1} of {pageCount || 1}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!table.getCanNextPage()}
          className={computeTablePagerButtonClasses({ disabled: !table.getCanNextPage() })}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </nav>
  )
}
