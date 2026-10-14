/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { KeyboardEvent, MouseEvent } from 'react'

export type SortState = 'asc' | 'desc' | false

/**
 * Map the TanStack sort state to the `aria-sort` token — for a SORTABLE column.
 *
 * `undefined` for every other column, and the attribute is then not emitted at
 * all. `aria-sort` is WAI-ARIA's declaration that a column header can be
 * sorted, so putting `none` on a selection checkbox or an action cluster
 * promises assistive technology an ordering that nothing can deliver. It used
 * to sit on every `<th>` unconditionally.
 */
export function ariaSortFor(
  canSort: boolean,
  sorted: SortState
): 'ascending' | 'descending' | 'none' | undefined {
  if (!canSort) return undefined
  if (sorted === 'asc') return 'ascending'
  if (sorted === 'desc') return 'descending'
  return 'none'
}

/** The instruction a sort control gives, read off where the column is now. */
export function sortActionLabel(sorted: SortState): string {
  if (sorted === 'asc') return 'Sort descending'
  if (sorted === 'desc') return 'Clear sort'
  return 'Sort ascending'
}

/**
 * Wrap the column's toggle so activating the BUTTON sorts exactly once.
 *
 * Built here, at module scope, rather than inline in the JSX below: the arrow
 * is then not created in the rendering scope, which is what `react-perf`'s
 * `jsx-no-new-function-as-prop` is measuring. A `useCallback` would not do — the
 * toggle it closes over is a fresh function on every render, so the memo would
 * never hold and the hook would only be there to quiet the rule.
 */
export function buildSortClick(
  toggle: ((event: unknown) => void) | undefined
): (event: MouseEvent<HTMLButtonElement>) => void {
  return (event) => {
    event.stopPropagation()
    toggle?.(event)
  }
}

/**
 * Enter or Space on a focused column header sorts it, exactly as a click does.
 *
 * It routes through the SAME `getToggleSortingHandler` the `<th>`'s `onClick`
 * already holds, so the keyboard cannot drift from the pointer: one gesture,
 * one cycle, one place to change it. `shiftKey` reaches the handler intact, so
 * multi-sort works from the keyboard on the grids that allow it.
 *
 * `preventDefault` is what keeps Space from scrolling the page out from under a
 * reader who just pressed it, and the `target !== currentTarget` guard keeps a
 * key pressed inside the header — the resize handle, a future control — from
 * bubbling up and sorting as well. Same guard, same reason, as the row action's
 * in `data-row.tsx`.
 *
 * Module scope, like `buildSortClick` above and for the same reason: the arrow
 * is then not created in the rendering scope, which is what `react-perf`'s
 * `jsx-no-new-function-as-prop` measures.
 */
export function buildSortKeyDown(
  toggle: ((event: unknown) => void) | undefined
): (event: KeyboardEvent<HTMLTableCellElement>) => void {
  return (event) => {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    toggle?.(event)
  }
}
