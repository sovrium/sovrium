/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableHeaderRowClasses,
  computeTableStickyHeaderClasses,
} from '@/presentation/design/table-default-classes'
import { HeaderCell } from './column-header/header-cell'
import { useFlowingHeaderPin } from './flowing-header-pin'
import { NO_FROZEN_OFFSETS, type FrozenOffsets } from './frozen-columns'
import type { DataTableHeaderGroup } from './island/table-features'
import type { ReactElement } from 'react'

interface TableHeaderProps {
  readonly headerGroups: readonly DataTableHeaderGroup[]
  /** Measured sticky offsets for the pinned columns — see `frozen-columns.ts`. */
  readonly frozenOffsets?: FrozenOffsets
  /**
   * Pin the whole section to the top of the grid's scroll region — set only
   * under `layout: fill`, which is what creates a scroll region for it to pin
   * to. Left off, the grid flows in its page and the page's scroll is what
   * would carry the labels away, so the section is carried down with a
   * transform instead (`flowing-header-pin.ts`) and wears the same opaque fill
   * and rule, which is what keeps the rows from showing through it.
   *
   * The pin goes on the SECTION, not on its cells: the two pin on different
   * axes here (a frozen column pins sideways, the labels pin upward), and only
   * the section box moving is what keeps a measurement of the header agreeing
   * with where the header is painted.
   */
  readonly sticky?: boolean
}

/**
 * Renders the table header with sortable columns
 */
export function TableHeader({
  headerGroups,
  frozenOffsets = NO_FROZEN_OFFSETS,
  sticky = false,
}: TableHeaderProps): ReactElement {
  const headRef = useFlowingHeaderPin(!sticky)
  return (
    <thead
      ref={headRef}
      data-slot="table-header"
      className={`${computeTableHeaderRowClasses()} ${computeTableStickyHeaderClasses()}`}
    >
      {headerGroups.map((headerGroup) => (
        <tr
          key={headerGroup.id}
          data-slot="table-row"
        >
          {headerGroup.headers.map((header) => (
            <HeaderCell
              key={header.id}
              header={header}
              frozenOffsets={frozenOffsets}
            />
          ))}
        </tr>
      ))}
    </thead>
  )
}
