/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableFillScrollClasses,
  computeTableScrollEdgeClasses,
  computeTableScrollFrameClasses,
} from '@/presentation/design/table-default-classes'
import { fillColumnWidths } from './fill-column-widths'
import { useGridString } from './grid-strings'
import { useScrollEdges } from './scroll-edges'
import type { DataTableInstance } from './table-features'
import type { ReactElement, ReactNode } from 'react'

/**
 * Two small parts of the grid's frame that hold it steady while it loads: the
 * `<colgroup>` that fixes a `fill` grid's column widths (see
 * `fill-column-widths.ts`), and the polite status that says a read is in
 * flight — the skeleton itself is `aria-hidden`, so the wait is SAID, once.
 */

/** The `<colgroup>` that fixes each column's width on a `fill` grid. */
export function FillColGroup({ table }: { readonly table: DataTableInstance }): ReactElement {
  return (
    <colgroup>
      {fillColumnWidths(table).map(({ id, width }) => (
        <col
          key={id}
          {...(width !== undefined && { style: { width } })}
        />
      ))}
    </colgroup>
  )
}

/** The "Loading records" status, announced while the records read is in flight. */
export function LoadingStatus({ loading }: { readonly loading: boolean }) {
  const label = useGridString('datatable.loading', 'Loading records')
  if (!loading) return undefined
  return (
    <p
      role="status"
      className="sr-only"
    >
      {label}
    </p>
  )
}

/** The scroll region's classes: sideways always, and vertically under `layout: fill`. */
const scrollRegionClass = (fills: boolean, rowHeight: string): string =>
  fills ? `overflow-x-auto ${computeTableFillScrollClasses({ rowHeight })}` : 'overflow-x-auto'

/**
 * The grid's scroll region, inside a frame that anchors its END edge: a shadow
 * over the region's right side, drawn while columns are still clipped past it
 * (see `scroll-edges.ts`). Under `layout: fill` the frame takes the region's
 * place in the flex chain, so the region grows and floors as it always did.
 */
export function ScrollRegion({
  fills,
  rowHeight,
  children,
}: {
  readonly fills: boolean
  readonly rowHeight: string
  readonly children: ReactNode
}): ReactElement {
  const edges = useScrollEdges()
  return (
    <div className={computeTableScrollFrameClasses(fills, rowHeight)}>
      <div
        ref={edges.regionRef}
        data-slot="table-container"
        className={scrollRegionClass(fills, rowHeight)}
        onScroll={edges.onScroll}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        data-scroll-edge="end"
        hidden={!edges.overflowEnd}
        className={computeTableScrollEdgeClasses()}
      />
    </div>
  )
}
