/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { QueryClient } from '@tanstack/react-query'

/**
 * How a grid catches up after its rows are deleted one at a time.
 *
 * A reader clearing a list deletes row after row, and re-reading the whole
 * page after each delete spent a read per delete — enough, on a long clean-up,
 * to run into the read budget and leave the page answering errors. So the row
 * leaves the grid at once, from the page already held, and the grid re-reads
 * the server ONCE, after the deletes have stopped for a moment: the read that
 * refills the page and corrects the count.
 */

/** How long the deletes must pause before the grid re-reads. */
const QUIET_MS = 1500

/** One pending re-read per grid query. */
const pendingRefresh = new Map<string, ReturnType<typeof setTimeout>>()

/** The page a grid holds, less the record `recordId`, its count one lower. */
const withoutRecord = (held: unknown, recordId: string): unknown => {
  if (typeof held !== 'object' || held === null) return held
  const page = held as { readonly records?: unknown; readonly total?: unknown }
  if (!Array.isArray(page.records)) return held
  const records = page.records.filter(
    (row: unknown) => String((row as { readonly id?: unknown } | null)?.id ?? '') !== recordId
  )
  if (records.length === page.records.length) return held
  const total = typeof page.total === 'number' ? Math.max(0, page.total - 1) : page.total
  return { ...page, records, total }
}

/**
 * Take a deleted record out of the grid's page now, and re-read the page once
 * the deletes have paused for {@link QUIET_MS}.
 */
export function removeRowThenRefreshOnce(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  recordId: string
): void {
  queryClient.setQueryData(queryKey, (held: unknown) => withoutRecord(held, recordId))
  const key = JSON.stringify(queryKey)
  clearTimeout(pendingRefresh.get(key))
  pendingRefresh.set(
    key,
    setTimeout(() => {
      pendingRefresh.delete(key)
      void queryClient.invalidateQueries({ queryKey })
    }, QUIET_MS)
  )
}
