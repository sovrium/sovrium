/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flexRender, type Header, type HeaderGroup } from '@tanstack/react-table'
import { useMemo } from 'react'
import { frozenHeaderStyle, NO_FROZEN_OFFSETS, type FrozenOffsets } from './frozen-columns'
import type { TableRecord } from '../shared/types'
import type { CSSProperties, ReactElement } from 'react'

interface TableHeaderProps {
  readonly headerGroups: readonly HeaderGroup<TableRecord>[]
  readonly cellClass: string
  /** Measured sticky offsets for the pinned columns — see `frozen-columns.ts`. */
  readonly frozenOffsets?: FrozenOffsets
}

/** Stops a synthetic event so a click on the resize handle does not bubble up
 *  to the `<th>` and trigger a column sort. */
const stopEvent = (event: React.SyntheticEvent) => event.stopPropagation()

type SortState = 'asc' | 'desc' | false

/** Map the TanStack sort state to the `<th aria-sort>` token. */
function ariaSortFor(sorted: SortState): 'ascending' | 'descending' | 'none' {
  if (sorted === 'asc') return 'ascending'
  if (sorted === 'desc') return 'descending'
  return 'none'
}

/**
 * Sort-direction indicator. `aria-hidden` keeps the accessible name of the
 * columnheader stable (`priority`, not `priority ↑`) so
 * `page.getByRole('columnheader', { name: 'priority' })` still resolves after
 * a sort click. The aria-label sits on the span for spec locators that look up
 * the indicator inside the header. Returns `undefined` when unsorted.
 */
function SortIndicator({ sorted }: { readonly sorted: SortState }): ReactElement | undefined {
  if (sorted === 'asc') {
    return (
      <span
        aria-label="sorted ascending"
        aria-hidden="true"
        className="sort-asc"
      >
        ↑
      </span>
    )
  }
  if (sorted === 'desc') {
    return (
      <span
        aria-label="sorted descending"
        aria-hidden="true"
        className="sort-desc"
      >
        ↓
      </span>
    )
  }
  return undefined
}

/**
 * Resize handle: an absolutely-positioned `<div>` on the right edge of the
 * header cell. It exposes `data-resize-handle` AND the `resize-handle` class so
 * spec locators (`locator('.resize-handle, [data-resize-handle]')`) resolve.
 * `onMouseDown` is wired to TanStack Table's `header.getResizeHandler()` —
 * pointer dragging then drives the controlled `columnSizing` state which the
 * orchestrator persists to user preferences. Returns `undefined` when the
 * column is not resizable.
 */
function ResizeHandle({
  header,
}: {
  readonly header: Header<TableRecord, unknown>
}): ReactElement | undefined {
  if (!header.column.getCanResize()) return undefined
  return (
    <div
      data-resize-handle
      // Visible 4px hit-area on the right edge of the header. Width must
      // be large enough for Playwright's `hover()` visibility check to
      // pass (zero-area divs are treated as invisible). The `bg-border`
      // baseline keeps it subtle until hover, when it brightens.
      className="resize-handle hover:bg-primary bg-border absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none opacity-50 select-none hover:opacity-100"
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onClick={stopEvent}
    />
  )
}

/**
 * The inline style a header cell wears: an explicit width when the USER resized
 * it, and the sticky pin when the column is frozen. `undefined` (the common
 * case) leaves the cell on the table's own auto layout with no style attribute.
 */
function headerCellStyle(
  meta: { frozen?: boolean; field?: string } | undefined,
  frozenOffsets: FrozenOffsets,
  width: number | undefined
): CSSProperties | undefined {
  const sizing = width === undefined ? undefined : { width, minWidth: width }
  if (meta?.frozen !== true) return sizing
  return { ...sizing, ...frozenHeaderStyle(frozenOffsets[meta.field ?? ''] ?? 0) }
}

/** Renders a single header cell with sort indicator + resize handle. */
function HeaderCell({
  header,
  cellClass,
  frozenOffsets,
}: {
  readonly header: Header<TableRecord, unknown>
  readonly cellClass: string
  readonly frozenOffsets: FrozenOffsets
}) {
  const meta = header.column.columnDef.meta as { frozen?: boolean; field?: string } | undefined
  // Apply an inline width ONLY when the user has explicitly resized this
  // column (the columnSizing state has an entry for it). This preserves
  // auto-layout for the natural case (every other data-table test) while
  // honoring persisted user widths post-reload.
  const { columnSizing } = header.getContext().table.getState()
  const userResized = columnSizing[header.column.id] !== undefined
  const width = userResized ? header.getSize() : undefined
  // A frozen header is PINNED: it stays at its own left offset while the rest of
  // the row scrolls underneath it. `data-frozen` alone never did that.
  const cellStyle = useMemo(
    () => headerCellStyle(meta, frozenOffsets, width),
    [meta, frozenOffsets, width]
  )
  return (
    <th
      key={header.id}
      className={`${cellClass} text-foreground-muted relative text-left text-xs font-medium tracking-wider uppercase ${
        header.column.getCanSort() ? 'cursor-pointer select-none' : ''
      }`}
      {...(cellStyle && { style: cellStyle })}
      onClick={header.column.getToggleSortingHandler()}
      aria-sort={ariaSortFor(header.column.getIsSorted())}
      {...(meta?.frozen && { 'data-frozen': 'true' })}
    >
      <div className="flex items-center gap-1">
        {header.isPlaceholder
          ? undefined
          : flexRender(header.column.columnDef.header, header.getContext())}
        <SortIndicator sorted={header.column.getIsSorted()} />
      </div>
      <ResizeHandle header={header} />
    </th>
  )
}

/**
 * Renders the table header with sortable columns
 */
export function TableHeader({
  headerGroups,
  cellClass,
  frozenOffsets = NO_FROZEN_OFFSETS,
}: TableHeaderProps): ReactElement {
  return (
    <thead className="bg-background-subtle">
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <HeaderCell
              key={header.id}
              header={header}
              cellClass={cellClass}
              frozenOffsets={frozenOffsets}
            />
          ))}
        </tr>
      ))}
    </thead>
  )
}
