/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flexRender } from '@tanstack/react-table'
import { headerLabelAlignClass } from '../column-align'
import { SortGlyph } from './sort-glyph'
import { buildSortClick, sortActionLabel } from './sort-state'
import type { DataTableHeader } from '../island/table-features'
import type { ReactElement } from 'react'

/**
 * The column label, and — where the column can be sorted — the control that
 * sorts it.
 *
 * The `<th>` has carried `onClick` since the grid shipped, so a reader could
 * always sort by clicking anywhere in the header — but nothing SAID so. A column
 * announced sortable through `aria-sort` offered a sighted reader no mark to aim
 * at and no cursor change to discover. The glyph button is that mark.
 *
 * ─── IT IS DELIBERATELY OUT OF THE ACCESSIBILITY TREE ─────────────────────
 *
 * `aria-hidden` with `tabIndex={-1}`: the control is redundant with the `<th>`
 * that contains it, and a redundant control that duplicates its container's
 * action is exactly what `aria-hidden` is for. No focusable element is hidden,
 * so the usual prohibition does not apply.
 *
 * It is not squeamishness. A `columnheader`'s accessible name is computed from
 * its CONTENTS, so ANY name this button carries becomes part of the column's,
 * and three spellings were measured against the suite before this one:
 *
 * - Button wrapping the label, named `Sort ascending` — renamed every column
 *   header in every grid after the action. 22 tests, and a screen-reader user
 *   heard the action where the field name belongs.
 * - Button wrapping the label, unnamed, with `aria-label` on the `<th>` — the
 *   W3C pattern plus an explicit header name. A button field draws a `Ship`
 *   button in every row and names its column `Ship`, so the header grew a second
 *   `Ship` button doing something else entirely; and the `<th>`'s `aria-label`
 *   is what `getByLabel('Name')` reads, so a grid beside a form began answering
 *   to the form's field names.
 * - Label outside, button named after the action — the header's name became
 *   `name Sort ascending`. Substring lookups survived that; an ANCHORED one
 *   (`{ name: /^name$/i }`) did not, and a column header whose name is not its
 *   column is wrong whether or not a test notices.
 *
 * Contributing NO name is the only spelling under which a column header is still
 * named exactly after its column. The accessibility tree is byte-identical to
 * what it was before this control existed.
 *
 * What that left open was the KEYBOARD, and it had been open since the grid
 * shipped: a `<th>` is not focusable and takes no Enter, so a column announced
 * sortable was never sortable without a pointer. Naming this button would not
 * have fixed it — the fix is a focusable HEADER, and `HeaderCell` below is where
 * it lives: a sortable `<th>` carries `tabIndex={0}` and answers Enter or Space
 * through the same toggle its `onClick` holds. `tabIndex` contributes no
 * accessible name, so the header is still named exactly after its column and
 * this control can stay out of the tree.
 *
 * `onClick` stops propagating before invoking the same handler the `<th>` holds,
 * so a press fires exactly once whether it lands on the glyph or on the padding
 * beside the label.
 */
export function HeaderLabel({ header }: { readonly header: DataTableHeader }): ReactElement {
  const sorted = header.column.getIsSorted()
  const label = header.isPlaceholder
    ? undefined
    : flexRender(header.column.columnDef.header, header.getContext())
  const rowClass = `flex items-center gap-1 ${headerLabelAlignClass(header.column.columnDef.meta?.align)}`
  if (!header.column.getCanSort()) {
    return <div className={rowClass}>{label}</div>
  }
  const action = sortActionLabel(sorted)
  return (
    <div className={rowClass}>
      {label}
      <button
        type="button"
        data-sort-control="true"
        aria-hidden="true"
        tabIndex={-1}
        title={action}
        className="inline-flex cursor-pointer items-center"
        onClick={buildSortClick(header.column.getToggleSortingHandler())}
      >
        <SortGlyph sorted={sorted} />
      </button>
    </div>
  )
}
