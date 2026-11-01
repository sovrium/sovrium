/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import type { DataTableInstance } from '../island/table-features'

/**
 * Does this grid hold more rows than one page shows?
 *
 * Judged against the SMALLEST page the reader can pick, so a reader who chose a
 * page large enough to hold every row keeps the select to step back down. And
 * judged on the dataset, not on what a search left of it: once the grid has
 * spanned pages in this visit it keeps its page navigation and its View menu,
 * so a reader who narrowed it to one row, or hid a field, keeps the way back.
 *
 * A grid that never spans pages draws neither: its rows are all on screen, and
 * a pager would only number the one page there is.
 */
export function useSpansPages(input: {
  readonly table: DataTableInstance
  readonly total: number
  readonly pageSizeOptions?: readonly number[]
}): boolean {
  const { pageIndex, pageSize } = input.table.state.pagination
  const smallest = Math.min(pageSize, ...(input.pageSizeOptions ?? []))
  const spans = pageIndex > 0 || input.total > smallest
  const [seen, setSeen] = useState(false)
  // Adjusting state during render: the latch is set in the same pass that first
  // sees a second page, so the chrome never flickers out on the next read.
  if (spans && !seen) setSeen(true)
  return spans || seen
}
