/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flexRender, type Header, type HeaderGroup } from '@tanstack/react-table'
import { useMemo } from 'react'
import type { TableRecord } from '../shared/types'
import type { ReactElement } from 'react'

interface TableHeaderProps {
  readonly headerGroups: readonly HeaderGroup<TableRecord>[]
  readonly cellClass: string
}

const stopEvent = (event: React.SyntheticEvent) => event.stopPropagation()

type SortState = 'asc' | 'desc' | false

function ariaSortFor(sorted: SortState): 'ascending' | 'descending' | 'none' {
  if (sorted === 'asc') return 'ascending'
  if (sorted === 'desc') return 'descending'
  return 'none'
}

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

function ResizeHandle({
  header,
}: {
  readonly header: Header<TableRecord, unknown>
}): ReactElement | undefined {
  if (!header.column.getCanResize()) return undefined
  return (
    <div
      data-resize-handle
      className="resize-handle hover:bg-primary bg-border absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none opacity-50 select-none hover:opacity-100"
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onClick={stopEvent}
    />
  )
}

function HeaderCell({
  header,
  cellClass,
}: {
  readonly header: Header<TableRecord, unknown>
  readonly cellClass: string
}) {
  const meta = header.column.columnDef.meta as { frozen?: boolean; field?: string } | undefined
  const { columnSizing } = header.getContext().table.getState()
  const userResized = columnSizing[header.column.id] !== undefined
  const width = userResized ? header.getSize() : undefined
  const widthStyle = useMemo(
    () => (width !== undefined ? { width, minWidth: width } : undefined),
    [width]
  )
  return (
    <th
      key={header.id}
      className={`${cellClass} text-foreground-muted relative text-left text-xs font-medium tracking-wider uppercase ${
        header.column.getCanSort() ? 'cursor-pointer select-none' : ''
      }`}
      {...(widthStyle && { style: widthStyle })}
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

export function TableHeader({ headerGroups, cellClass }: TableHeaderProps): ReactElement {
  return (
    <thead className="bg-background-subtle">
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <HeaderCell
              key={header.id}
              header={header}
              cellClass={cellClass}
            />
          ))}
        </tr>
      ))}
    </thead>
  )
}
