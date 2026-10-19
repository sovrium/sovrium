/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { forgetReadsInFlight } from '../runtime/coalesced-read'
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
   * The column whose sort the failed read was carrying, when the failure undid
   * one — so the notice can say WHICH sort was refused instead of a generic
   * load failure. `undefined` for a read that failed with no sort change.
   */
  readonly refusedSortColumn: string | undefined
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
  const [refusedSortColumn, setRefusedSortColumn] = useState<string | undefined>(undefined)
  // The sort in effect before the pending change — where a refusal returns to.
  const previousSorting = useRef<SortingState>(sorting)
  // The sort the failing read carried, read when it fails (the effect below
  // runs on the failure, not on every sort change).
  const liveSorting = useRef<SortingState>(sorting)
  useEffect(() => {
    liveSorting.current = sorting
  }, [sorting])

  const onSortingChange = useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      previousSorting.current = sorting
      setReadError(undefined)
      setRefusedSortColumn(undefined)
      setSorting(updater)
    },
    [sorting, setSorting]
  )

  useEffect(() => {
    if (!isError) return
    setReadError(error)
    setRefusedSortColumn(refusedColumn(previousSorting.current, liveSorting.current))
    // Undo the sort this read was carrying. When the failure had nothing to do
    // with a sort — an initial load that simply failed — the snapshot equals the
    // live value and this settles on the same query key; the notice is still the
    // right answer, and it is shown above whatever the grid can render.
    setSorting(previousSorting.current)
  }, [isError, error, setSorting])

  const clearReadError = useCallback(() => {
    setReadError(undefined)
    setRefusedSortColumn(undefined)
  }, [])

  return { readError, refusedSortColumn, onSortingChange, clearReadError }
}

/** The column a sort change added or re-directed, or `undefined` when none did. */
function refusedColumn(before: SortingState, after: SortingState): string | undefined {
  const changed = after.find(
    (entry) => !before.some((prior) => prior.id === entry.id && prior.desc === entry.desc)
  )
  return changed?.id
}

/**
 * Re-read a grid's query — including while its FIRST read is still in flight.
 *
 * `invalidateQueries` alone is not enough, and the hole is invisible until a
 * fast mutation beats a slow first read. `Query.fetch` takes its
 * cancel-and-refetch branch only when `state.data !== undefined`; before a
 * query has ever resolved there is no data to keep on screen, so it takes the
 * DEDUP branch instead and returns the in-flight promise. The query is left
 * flagged invalidated, no request goes out, and the response that eventually
 * lands was requested BEFORE the event that asked for the re-read — so the grid
 * settles, permanently, on data older than the mutation it was just told about.
 * Nothing re-triggers it afterwards: a system-source grid has no poll interval,
 * does not remount, and the operator never leaves the tab.
 *
 * Measured on the upload → sibling-grid composition: the grid's first read went
 * out 70 ms before the upload POST and was still open 86 ms after its 201, and
 * the row never appeared — no second request was ever issued.
 *
 * `cancelQueries` carries no such guard, so cancelling first makes the
 * following invalidate always reach the network. For a query that already holds
 * data this changes nothing — `invalidateQueries` cancels it anyway, since
 * `cancelRefetch` defaults to `true` — so only the first-read case moves.
 *
 * Reaching the network takes one more step for a system-source grid: its reads
 * share identical requests in flight (`fetchCoalesced`), and cancelling the
 * query does not abort the request it made — so the re-read would join that
 * very request and receive its pre-mutation answer after all. Forgetting the
 * reads in flight first sends the re-read on its own.
 */
export async function refreshGridQuery(
  queryClient: Readonly<QueryClient>,
  queryKey: readonly unknown[]
): Promise<void> {
  forgetReadsInFlight()
  await queryClient.cancelQueries({ queryKey })
  await queryClient.invalidateQueries({ queryKey })
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
    void refreshGridQuery(queryClient, queryKey)
  }, [queryClient, queryKey, clearReadError])
}
