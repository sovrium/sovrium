/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'

/**
 * Keep a grid's sort honest about what the server actually agreed to serve.
 *
 * A data-table adopts a sort OPTIMISTICALLY: a header click writes `sorting`
 * into React state, and that state feeds BOTH the request and the TanStack query
 * key. A new key has no cached entry, so the rows the operator was reading were
 * dropped the instant they clicked — before the server had said anything — and
 * if the read then failed there was nothing to fall back to and nothing that
 * undid the sort. Measured on a live console, one click on a column whose key
 * the endpoint refuses produced: the header claiming `ascending`, then five
 * skeleton rows in place of the operator's data, then an error banner in place
 * of the ENTIRE table — headers, toolbar and search box included — with no way
 * back except a page reload, because the sort lived in React state rather than
 * the URL and the header that would have toggled it off no longer existed.
 *
 * So the failure was never "the rows do not reorder". It was that one click on a
 * column header could annihilate the surface, while the header actively claimed
 * the sort had succeeded.
 *
 * This hook makes the adoption REVERSIBLE. It remembers the sort in effect
 * before each change; when the read that change triggered fails, it puts that
 * sort back and records the failure as a notice. The revert returns the query to
 * its previous key — which still holds its cached page — so the rows and their
 * order come back on their own, and `aria-sort` returns to `none` because the
 * state driving it is genuinely back where it was.
 *
 * ## Why revert rather than merely report only what was confirmed
 *
 * Holding the requested sort in state while REPORTING a separate confirmed one
 * would keep the header honest too, and it is the shape one reaches for first.
 * It breaks the retry: TanStack computes a header's next sort from the state it
 * is shown, so a second click on a header still reporting `none` recomputes the
 * same `ascending` value, the query key does not change, and nothing refetches —
 * the operator clicks and the console does nothing at all. Reverting keeps the
 * two in step, so a second click is a genuinely new request, which is exactly
 * what an operator does after being told the first one failed.
 *
 * ## Why the notice outlives the query status
 *
 * Because the revert cures `isError`. Returning to the previous key resolves
 * from cache within a frame or two, so a banner rendered off the live query
 * status would appear and vanish faster than anyone could read it, leaving the
 * operator to conclude their sort had silently done nothing — the very failure
 * this exists to remove. The notice is therefore held separately and retired on
 * the operator's next deliberate act: sorting again, or refreshing. A background
 * poll succeeding does not retire it, because a poll does not answer the
 * question the operator asked.
 */
export interface UseSortRefusalParams {
  /** Whether the current read has failed. */
  readonly isError: boolean
  /** The failure itself, surfaced verbatim in the notice. */
  readonly error: unknown
  /** Live sort state — snapshotted so a refusal has somewhere to return to. */
  readonly sorting: SortingState
  /** The underlying setter, wrapped by {@link UseSortRefusal.onSortingChange}. */
  readonly setSorting: OnChangeFn<SortingState>
}

export interface UseSortRefusal {
  /**
   * The last read failure the operator has not yet acted on, or `undefined`.
   *
   * Rendered ALONGSIDE the grid rather than instead of it: a failed re-read is a
   * reason to keep showing the last good page with a notice on top, never a
   * reason to delete the surface the operator was working in.
   */
  readonly readError: unknown
  /**
   * Drop-in replacement for the table's `onSortingChange`. Snapshots the sort
   * being replaced, and retires any outstanding notice — the operator is asking
   * a new question, so the answer to the old one stops being news.
   */
  readonly onSortingChange: OnChangeFn<SortingState>
  /** Retire the notice — for an explicit refresh, which is also a new question. */
  readonly clearReadError: () => void
}

export function useSortRefusal(
  isError: boolean,
  error: unknown,
  state: Readonly<Pick<UseSortRefusalParams, 'sorting' | 'setSorting'>>
): UseSortRefusal {
  const { sorting, setSorting } = state
  const [readError, setReadError] = useState<unknown>(undefined)
  // The sort in effect before the pending change — where a refusal returns to.
  const previousSorting = useRef<SortingState>(sorting)

  const onSortingChange = useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      // eslint-disable-next-line functional/immutable-data -- ref slot recording the sort a refusal must restore
      previousSorting.current = sorting
      setReadError(undefined)
      setSorting(updater)
    },
    [sorting, setSorting]
  )

  useEffect(() => {
    if (!isError) return
    setReadError(error)
    // Undo the sort this read was carrying. When the failure had nothing to do
    // with a sort — an initial load that simply failed — the snapshot equals the
    // live value and this settles on the same query key; the notice is still the
    // right answer, and it is shown above whatever the grid can render.
    setSorting(previousSorting.current)
  }, [isError, error, setSorting])

  const clearReadError = useCallback(() => setReadError(undefined), [])

  return { readError, onSortingChange, clearReadError }
}

/**
 * The grid's manual "re-read now" action.
 *
 * Invalidating the query is the obvious half. The other half is that a refresh
 * is a NEW question, so it retires whatever read notice was still standing —
 * otherwise a banner explaining a refused sort hangs over rows that were fetched
 * successfully afterwards, and the operator is told something is wrong with the
 * freshest thing on the page. It lives beside {@link useSortRefusal} because it
 * is the second half of that notice's lifecycle, not a query concern.
 */
export function useGridRefresh(
  queryClient: Readonly<QueryClient>,
  queryKey: readonly unknown[],
  clearReadError: () => void
): () => void {
  return useCallback(() => {
    clearReadError()
    void queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey, clearReadError])
}
