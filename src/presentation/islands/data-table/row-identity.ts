/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DataTableRow } from './island/table-features'

/**
 * The identity a rendered row answers to — the value `<tr data-row-id>`
 * carries, the key React reconciles the row by, and the `rowId` half of the
 * cell cursor.
 *
 * ONE expression, because three things have to agree on it or the grid comes
 * apart in ways no type-checker sees: the cursor resolves a `<td>` by
 * `data-row-id`, React moves a row's node on re-order by its key, and the
 * fill handle finds the source record by the cursor's `rowId`. When this was
 * spelled six times over, a spelling that drifted in one place would have
 * left the cursor pointing at a row React had keyed differently.
 *
 * The record's own `id` wins; `row.id` — TanStack's row INDEX, since no
 * `getRowId` is configured — is only the fallback for a record without one.
 */
export const rowIdOf = (row: DataTableRow): string => String(row.original.id ?? row.id)

/**
 * The ids of the rows drawn beside `row` — every record row of its grid, in
 * screen order, across the grid's groups (a grouped grid draws one body per
 * group; its group header rows carry no record), so after the grid's own sort,
 * filter, grouping and paging. `[]` without an element.
 */
export const siblingRowIds = (row: Element | undefined): readonly string[] =>
  Array.from(
    row?.closest('table')?.querySelectorAll(':scope > tbody > tr[data-row-id]') ?? [],
    (tr) => tr.getAttribute('data-row-id') ?? ''
  ).filter((id) => id !== '')

/**
 * Where the rows beside `row` sit in the whole list the grid reads: the rows
 * before its page and the list's total, as the grid's pager states them, or
 * `{}` when there is no pager to read.
 */
export const rowListWindow = (
  row: Element | undefined
): { readonly offset?: number; readonly total?: number } => {
  const pager = row?.closest('[data-island]')?.querySelector('[data-row-total]')
  if (pager === null || pager === undefined) return {}
  const total = Number(pager.getAttribute('data-row-total'))
  const offset = Number(pager.getAttribute('data-row-offset'))
  return Number.isInteger(total) && total > 0 && Number.isInteger(offset) ? { offset, total } : {}
}
