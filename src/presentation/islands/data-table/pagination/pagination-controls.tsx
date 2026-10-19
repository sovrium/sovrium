/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, type ReactNode } from 'react'
import {
  computeTablePagerButtonClasses,
  computeTablePagerClasses,
  computeTablePagerSelectClasses,
} from '@/presentation/design/table-default-classes'
import { usePhoneViewport } from '../../hooks/use-phone-viewport'
import { useGridString, useResultCount } from '../island/grid-strings'
import { PagerEdgeButton } from './pager-edge-button'
import type { DataTableInstance } from '../island/table-features'

interface PaginationControlsProps {
  readonly table: DataTableInstance
  readonly total: number
  /**
   * The rows have no answer yet — a first read, one being retried after a
   * fault, or one that failed before any row arrived. The summary says nothing
   * then: "No results" over a read that never came back is a claim the grid
   * never got from the server.
   */
  readonly reading?: boolean
  readonly pageSizeOptions?: readonly number[]
  /**
   * Which edge of the grid this pager sits on. It decides the separating border
   * only — a pager above the rows is bordered underneath, one below is bordered
   * on top — so the rule always falls between the pager and the rows it counts.
   * WHERE the pager is placed is `GridBody`'s call, not this one's.
   */
  readonly position?: 'top' | 'bottom'
  /**
   * What takes the bar's LEFT half instead of the range summary — the selection,
   * once rows are checked. Absent, the summary says where in the list the
   * reader is.
   */
  readonly leading?: ReactNode
  /** The reader's session controls, first in the right half. */
  readonly trailing?: ReactNode
  /**
   * The page-size select and the steps. Off on a bar drawn for a grid that does
   * not number its pages — one that only selects — which keeps the bar for
   * its selection and its session controls.
   */
  readonly paged?: boolean
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
  const pageSizeLabel = useGridString('datatable.pagination.pageSizeLabel', 'Page size')
  const pageSizeTemplate = useGridString('datatable.pagination.pageSize', '{size} / page')
  return (
    <select
      data-page-size
      value={pageSize}
      onChange={onChange}
      className={computeTablePagerSelectClasses()}
      aria-label={pageSizeLabel}
    >
      {pageSizeOptions.map((size) => (
        <option
          key={size}
          value={size}
        >
          {pageSizeTemplate.replace('{size}', String(size))}
        </option>
      ))}
    </select>
  )
}

/**
 * The pager's words in the page language (`datatable.pagination.*`): the range
 * summary, the page label, and the two step buttons' captions and names.
 */
function usePagerLabels(input: {
  readonly pageIndex: number
  readonly pageSize: number
  readonly pageCount: number
  readonly total: number
  readonly paged: boolean
}) {
  const { pageIndex, pageSize, pageCount, total, paged } = input
  const range = useGridString('datatable.pagination.range', '{from}–{to} of {total}', {
    from: pageIndex * pageSize + 1,
    to: Math.min((pageIndex + 1) * pageSize, total),
    total,
  })
  const noResults = useGridString('datatable.pagination.empty', 'No results')
  // A bar that numbers no pages counts the rows instead of a range of them.
  const count = useResultCount(total)
  return {
    // The rows before this page, which a bar numbering no pages has none of.
    offset: paged ? pageIndex * pageSize : 0,
    summary: paged ? (total > 0 ? range : noResults) : count,
    page: useGridString('datatable.pagination.page', 'Page {page} of {count}', {
      page: pageIndex + 1,
      count: pageCount || 1,
    }),
    // The readout a phone draws when the bar spends its width on the endpoint's
    // own result sentence: `1 / 2`. Empty when the grid sends no such sentence.
    pageShort: useGridString('datatable.pagination.pageShort', '', {
      page: pageIndex + 1,
      count: pageCount || 1,
    }),
    previous: useGridString('datatable.pagination.previous', 'Previous'),
    previousLabel: useGridString('datatable.pagination.previousLabel', 'Previous page'),
    next: useGridString('datatable.pagination.next', 'Next'),
    nextLabel: useGridString('datatable.pagination.nextLabel', 'Next page'),
    firstLabel: useGridString('datatable.pagination.firstLabel', 'First page'),
    lastLabel: useGridString('datatable.pagination.lastLabel', 'Last page'),
  }
}

/**
 * The pager's steps, shadcn/ui's `DataTablePagination` controls: first page,
 * previous, the page readout, next, last page. Each is disabled where there is
 * nowhere to go.
 */
function PagerSteps({
  table,
  labels,
}: {
  readonly table: DataTableInstance
  readonly labels: ReturnType<typeof usePagerLabels>
}) {
  const canBack = table.getCanPreviousPage()
  const canOn = table.getCanNextPage()
  const short = usePhoneViewport(labels.pageShort !== '')
  return (
    <>
      <PagerEdgeButton
        edge="first"
        label={labels.firstLabel}
        disabled={!canBack}
        onClick={() => table.firstPage()}
      />
      <button
        type="button"
        onClick={() => table.previousPage()}
        disabled={!canBack}
        className={computeTablePagerButtonClasses({ disabled: !canBack })}
        aria-label={labels.previousLabel}
      >
        {labels.previous}
      </button>
      {short ? (
        <span
          className="whitespace-nowrap"
          aria-label={labels.page}
        >
          {labels.pageShort}
        </span>
      ) : (
        <span className="whitespace-nowrap">{labels.page}</span>
      )}
      <button
        type="button"
        onClick={() => table.nextPage()}
        disabled={!canOn}
        className={computeTablePagerButtonClasses({ disabled: !canOn })}
        aria-label={labels.nextLabel}
      >
        {labels.next}
      </button>
      <PagerEdgeButton
        edge="last"
        label={labels.lastLabel}
        disabled={!canOn}
        onClick={() => table.lastPage()}
      />
    </>
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
 * so the summary never reads louder than the values it counts.
 *
 * On a phone the two halves do not fit one row once the page-size select
 * holds `100 / page`. The bar wraps rather than squeezing: each half keeps
 * its words on one line, and `ml-auto` keeps the controls at the end edge
 * when they drop to a second row. Squeezed, the summary broke as
 * "1–100 of / 150". The controls wrap too: at 375px the page-size select
 * and the four steps are wider than the bar, and the last step was clipped.
 */
export function PaginationControls(props: PaginationControlsProps) {
  const { table, total, pageSizeOptions, position = 'bottom', paged = true } = props
  const { pageIndex, pageSize } = table.state.pagination
  const pageCount = table.getPageCount()

  const onPageSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => table.setPageSize(Number(e.target.value)),
    [table]
  )

  const labels = usePagerLabels({ pageIndex, pageSize, pageCount, total, paged })
  const summary = props.reading === true && total === 0 ? '' : labels.summary

  return (
    <nav
      aria-label="pagination"
      data-slot="data-table-pagination"
      data-pagination
      // Where the page sits in the whole list, for a record sheet's `n of N`.
      data-row-offset={labels.offset}
      data-row-total={total}
      className={`${computeTablePagerClasses({ position })} flex-wrap justify-between gap-y-1`}
    >
      {props.leading ?? <span className="whitespace-nowrap">{summary}</span>}
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
        {props.trailing}
        {paged && pageSizeOptions && pageSizeOptions.length > 0 && (
          <PageSizeSelect
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            onChange={onPageSizeChange}
          />
        )}
        {paged && (
          <PagerSteps
            table={table}
            labels={labels}
          />
        )}
      </div>
    </nav>
  )
}
