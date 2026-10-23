/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy, Suspense, type KeyboardEvent, type ReactElement } from 'react'
import { rowIdOf } from '../row-identity'
import { useInlineExpand } from './inline-expand-context'
import type { DataTableRow } from '../island/table-features'

/** The record's own form, loaded the first time a row opens: most grids never open one. */
const InlineRecord = lazy(() => import('./inline-record'))

/** lucide's `chevron-right`, turned down while the row is open. */
const CHEVRON = 'm9 18 6-6-6-6'

/** Keys the grid's own keyboard handling must not see while they act on the toggle. */
const keepFromGrid = (event: KeyboardEvent): void => {
  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
}

/**
 * The toggle a row carries when its record opens under it: a button whose
 * `aria-expanded` says whether the record is drawn, answering a click, Enter
 * and Space as any button does.
 */
export function InlineExpandToggle({ row }: { readonly row: DataTableRow }): ReactElement | null {
  const expand = useInlineExpand()
  if (expand === undefined) return null
  const rowId = rowIdOf(row)
  const expanded = expand.isExpanded(rowId)
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={expand.config.toggleLabel}
      data-inline-expand-toggle=""
      onClick={(event) => {
        event.stopPropagation()
        expand.toggle(rowId)
      }}
      onKeyDown={keepFromGrid}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex size-6 items-center justify-center rounded outline-none focus-visible:ring-[3px]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`size-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
      >
        <path d={CHEVRON} />
      </svg>
    </button>
  )
}

/**
 * The open record of `row`, drawn by the record's own form from the row the
 * grid already holds: keyed by its values, so a re-read bringing new ones
 * draws them, while one bringing the same keeps what the reader is typing.
 * Keys typed into it stay out of the grid's own keyboard handling.
 */
export function InlineRecordBody({ row }: { readonly row: DataTableRow }): ReactElement | null {
  const expand = useInlineExpand()
  if (expand === undefined || !expand.isExpanded(rowIdOf(row))) return null
  return (
    <section
      aria-label={expand.config.title}
      data-inline-record=""
      className="flex flex-col gap-3 px-3 py-3 whitespace-normal"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Suspense fallback={null}>
        <InlineRecord
          key={JSON.stringify(row.original)}
          record={row.original}
          config={expand.config}
          table={expand.table}
        />
      </Suspense>
    </section>
  )
}

/** The open record as one full-width row of the table, directly under its row. */
export function InlineExpansionRow({ row }: { readonly row: DataTableRow }): ReactElement | null {
  const expand = useInlineExpand()
  if (expand === undefined || !expand.isExpanded(rowIdOf(row))) return null
  return (
    <tr
      role="row"
      data-slot="table-row"
      data-inline-expansion=""
    >
      <td
        data-slot="table-cell"
        colSpan={row.getVisibleCells().length}
        className="bg-muted/30 p-0"
      >
        <InlineRecordBody row={row} />
      </td>
    </tr>
  )
}
