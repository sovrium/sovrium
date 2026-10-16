/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flexRender } from '@tanstack/react-table'
import { computeTableSortButtonClasses } from '@/presentation/design/table-default-classes'
import { headerLabelAlignClass } from '../column-align'
import { useGridString } from '../island/grid-strings'
import { SortGlyph } from './sort-glyph'
import { buildSortClick, sortActionLabel } from './sort-state'
import type { DataTableHeader } from '../island/table-features'
import type { ReactElement } from 'react'

/**
 * The column label, and — where the column can be sorted — the control that
 * sorts it.
 *
 * A sortable header is shadcn/ui's data-table header: ONE button wrapping the
 * column's label and its sort glyph. It is in the tab order and answers Enter
 * and Space as any button does, so the header cell itself is no longer a
 * second, unannounced tab stop.
 *
 * ─── THE BUTTON IS NAMED EXACTLY THE COLUMN LABEL ─────────────────────────
 *
 * A `columnheader`'s accessible name is computed from its CONTENTS, so the
 * button's name becomes the column's. Named after the action (`Sort
 * ascending`) it renamed every column in every grid; named after the label it
 * leaves the header named exactly as before, and `aria-sort` on the `<th>`
 * announces the state. The glyph is `aria-hidden`, so it contributes nothing;
 * `title` gives a pointer reader the action as a description.
 *
 * `sortable` is false on an empty grid: with no rows there is nothing to
 * order, so no header offers to order it.
 *
 * `onClick` stops propagating before invoking the same handler the `<th>`
 * holds, so a press fires exactly once whether it lands on the button or on
 * the padding beside it.
 */
export function HeaderLabel({
  header,
  sortable,
}: {
  readonly header: DataTableHeader
  readonly sortable: boolean
}): ReactElement {
  const sorted = header.column.getIsSorted()
  const action = useGridString(...sortActionLabel(sorted))
  const label = header.isPlaceholder
    ? undefined
    : flexRender(header.column.columnDef.header, header.getContext())
  const rowClass = `flex items-center gap-1 ${headerLabelAlignClass(header.column.columnDef.meta?.align)}`
  if (!sortable) {
    return <div className={rowClass}>{label}</div>
  }
  return (
    <div className={rowClass}>
      <button
        type="button"
        data-sort-control="true"
        title={action}
        className={computeTableSortButtonClasses()}
        onClick={buildSortClick(header.column.getToggleSortingHandler())}
      >
        {label}
        <SortGlyph sorted={sorted} />
      </button>
    </div>
  )
}
