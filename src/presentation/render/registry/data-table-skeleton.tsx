/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeStaticTableBodyClasses,
  computeStaticTableCellClasses,
  computeStaticTableContainerClasses,
  computeStaticTableRowClasses,
  computeStaticTableShellClasses,
} from '@/presentation/design/display-default-classes'
import { DrawnGrid } from '@/presentation/design/drawn-grid'
import { computeTableSkeletonBarClasses } from '@/presentation/design/table-default-classes'
import { drawnGridPageOf, type DrawnRows } from '@/presentation/render/resolve/drawn-island-content'
import type { ReactElement } from 'react'

/**
 * The widths the placeholder bars cycle through, so the skeleton reads as text
 * of differing lengths rather than as a regular grid of blocks.
 */
const SKELETON_BAR_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/5', 'w-5/12'] as const

/** One row of pulse bars, one per column, in a head or a body cell. */
function SkeletonCells({ kind }: { readonly kind: 'header' | 'data' }): ReactElement {
  return (
    <>
      {SKELETON_BAR_WIDTHS.map((width) => (
        <div
          key={width}
          data-slot={kind === 'header' ? 'table-head' : 'table-cell'}
          className={`table-cell ${computeStaticTableCellClasses({ kind })}`}
        >
          <div className={`${computeTableSkeletonBarClasses()} ${width}`} />
        </div>
      ))}
    </>
  )
}

/**
 * The pre-hydration grid placeholder: the static table's `Table` anatomy and
 * recipes (`data-slot` table, header, body, rows and cells), its cells holding
 * pulse bars, so the grid that hydrates over it keeps its shape. It is laid out
 * with CSS table display rather than a `<table>` element: a `<table>` in a grid
 * host is the sign the grid has hydrated, and a placeholder must not give it.
 * `label` is its status name in the page language (`datatable.loadingTable`).
 */
export function DataTableSkeleton({ label }: { readonly label: string }): ReactElement {
  return (
    <div
      data-loading-status=""
      aria-label={label}
      role="status"
      data-slot="table-container"
      className={computeStaticTableContainerClasses()}
    >
      <div
        data-slot="table"
        className={`table ${computeStaticTableShellClasses()}`}
      >
        <div
          data-slot="table-header"
          className="table-header-group"
        >
          <div
            data-slot="table-row"
            className={`table-row ${computeStaticTableRowClasses()}`}
          >
            <SkeletonCells kind="header" />
          </div>
        </div>
        <div
          data-slot="table-body"
          className={`table-row-group ${computeStaticTableBodyClasses()}`}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`skeleton-${String(i)}`}
              data-slot="table-row"
              className={`table-row ${computeStaticTableRowClasses()}`}
            >
              <SkeletonCells kind="data" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A grid's placeholder: its drawn first page when the server read one, else the skeleton. */
export function GridPlaceholder({
  drawn,
  columns,
  label,
}: {
  readonly drawn: DrawnRows | undefined
  readonly columns: unknown
  readonly label: string
}): ReactElement {
  if (drawn === undefined) return <DataTableSkeleton label={label} />
  return <DrawnGrid {...drawnGridPageOf(drawn, columns)} />
}
