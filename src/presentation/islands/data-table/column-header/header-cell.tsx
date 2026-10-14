/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo } from 'react'
import { computeTableHeaderCellClasses } from '@/presentation/design/table-default-classes'
import { columnPlacementClass } from '../column-align'
import { FROZEN_CELL_CLASS, frozenHeaderStyle, type FrozenOffsets } from '../frozen-columns'
import { HeaderLabel } from './header-label'
import { ResizeHandle } from './resize-handle'
import { ariaSortFor, buildSortKeyDown } from './sort-state'
import type { DataTableColumnMeta, DataTableHeader } from '../island/table-features'
import type { CSSProperties } from 'react'

/**
 * The inline style a header cell wears: an explicit width when the USER resized
 * it, and the sticky pin when the column is frozen. `undefined` (the common
 * case) leaves the cell on the table's own auto layout with no style attribute.
 */
function headerCellStyle(
  meta: DataTableColumnMeta | undefined,
  frozenOffsets: FrozenOffsets,
  width: number | undefined
): CSSProperties | undefined {
  const sizing = width === undefined ? undefined : { width, minWidth: width }
  if (meta?.frozen !== true) return sizing
  return { ...sizing, ...frozenHeaderStyle(frozenOffsets[meta.field ?? ''] ?? 0) }
}

/** The class list of a header cell: the recipe, its alignment, sort and pin. */
function headerCellClassName(meta: DataTableColumnMeta | undefined, canSort: boolean): string {
  return `${computeTableHeaderCellClasses()} relative ${columnPlacementClass(meta)} ${
    canSort ? 'cursor-pointer select-none' : ''
  } ${meta?.frozen === true ? FROZEN_CELL_CLASS : ''}`
}

/** Renders a single header cell with sort indicator + resize handle. */
export function HeaderCell({
  header,
  frozenOffsets,
}: {
  readonly header: DataTableHeader
  readonly frozenOffsets: FrozenOffsets
}) {
  const { meta } = header.column.columnDef
  // Apply an inline width when the READER has resized this column, and
  // otherwise when the CONFIG declared one. A column that has neither gets no
  // width at all and stays on the table's auto layout, which is the natural
  // case and what every other data-table test measures.
  //
  // The reader wins over the config: a drag is the more recent instruction, and
  // `getSize()` already reports the dragged width once `columnSizing` holds an
  // entry. It cannot stand in for the config width, though — TanStack merges a
  // 150px default into every column def, so `getSize()` on an unauthored column
  // reports a number nobody asked for. `meta.authoredWidth` is present only
  // when the column really declared one.
  //
  // `HeaderContext.table` is the CORE table, which carries `atoms` but not the
  // React wrapper's `.state` — so the slice is read off its atom directly.
  const columnSizing = header.getContext().table.atoms.columnSizing.get()
  const userResized = columnSizing[header.column.id] !== undefined
  const width = userResized ? header.getSize() : meta?.authoredWidth
  // A frozen header is PINNED: it stays at its own left offset while the rest of
  // the row scrolls underneath it. `data-frozen` alone never did that.
  const cellStyle = useMemo(
    () => headerCellStyle(meta, frozenOffsets, width),
    [meta, frozenOffsets, width]
  )
  const canSort = header.column.getCanSort()
  return (
    <th
      key={header.id}
      data-slot="table-head"
      // `cellClass` deliberately does NOT reach here any more. It is the BODY's
      // density map, and interpolating it grew the column labels' padding
      // whenever the reader asked for taller rows. A header's padding is a
      // constant of the design; the recipe owns it.
      className={headerCellClassName(meta, canSort)}
      {...(cellStyle && { style: cellStyle })}
      onClick={header.column.getToggleSortingHandler()}
      aria-sort={ariaSortFor(canSort, header.column.getIsSorted())}
      {...(meta?.frozen && { 'data-frozen': 'true' })}
      {...(canSort && {
        tabIndex: 0,
        onKeyDown: buildSortKeyDown(header.column.getToggleSortingHandler()),
      })}
    >
      <HeaderLabel header={header} />
      <ResizeHandle header={header} />
    </th>
  )
}
