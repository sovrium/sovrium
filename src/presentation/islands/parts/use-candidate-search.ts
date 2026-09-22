/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import type { ListboxCandidate } from './option-listbox'

/**
 * Search state for the two pickers that fetch their candidates.
 *
 * Both the record picker and the user picker do the same thing — take a typed
 * term, ask the server for a capped page of matches, and hand a candidate list
 * to the shared listbox — so the term, the debounce, the in-flight guard and
 * the failure handling live here once rather than twice.
 *
 * The cap is applied SERVER-SIDE by both callers. A 10k-row related table is
 * handled by never fetching it: an empty term asks for the first page rather
 * than for everything, so the picker's cost does not depend on the table's size.
 *
 * Paging is built on `useInfiniteQuery` rather than a hand-rolled accumulator:
 * a new search term is a new query key, which resets to page 1 for free, and
 * "load more" is `fetchNextPage()` — fetched pages are kept and appended,
 * never replaced, which is exactly the "in place" contract the picker needs.
 */

/** How long typing settles before a request goes out. */
const SEARCH_DEBOUNCE_MS = 200

/** The first page a search asks for. */
const FIRST_PAGE = 1

/** One page of candidates, plus whether another page exists beyond it. */
export interface CandidatePage {
  readonly candidates: readonly ListboxCandidate[]
  readonly hasMore: boolean
  /**
   * How many rows match in total, when the endpoint reports it.
   *
   * Read by the surface that can honestly SHOW a count — one that has loaded
   * every page. A total beside a partial list would be a claim about the table
   * that a paged response cannot support, and a reader who sees one assumes
   * they are looking at all of it.
   */
  readonly total?: number
}

export interface CandidateSearch {
  readonly term: string
  readonly setTerm: (next: string) => void
  readonly candidates: readonly ListboxCandidate[]
  readonly loading: boolean
  readonly failed: boolean
  /** Whether another page can be fetched beyond what is already shown. */
  readonly hasMore: boolean
  /** Total matching rows, when the endpoint reported one. */
  readonly total: number | undefined
  /** Fetches and appends the next page, in place. */
  readonly loadMore: () => void
}

export function useCandidateSearch(
  fetchCandidates: (term: string, page: number, signal: AbortSignal) => Promise<CandidatePage>,
  /** Re-runs the search when this changes — the endpoint or table it targets. */
  sourceKey: string
): CandidateSearch {
  const [term, setTerm] = useState('')
  // The first fetch is immediate: the picker opens on a double-click, and waiting
  // out a typing debounce before showing ANY candidate would make the control look
  // empty at the moment it appears.
  const debouncedTerm = useDebouncedValue(term, SEARCH_DEBOUNCE_MS, (value) => value === '')

  const query = useInfiniteQuery({
    queryKey: ['picker-candidates', sourceKey, debouncedTerm],
    // The abort signal is TanStack's, and it fires for the same reason the
    // hand-rolled `AbortController` did — a newer key superseded this request.
    // The difference is that a superseded answer no longer has to be RECOGNISED
    // and dropped: it belongs to a key nothing is observing.
    queryFn: ({ pageParam, signal }) => fetchCandidates(debouncedTerm, pageParam, signal),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + 1 : undefined,
    // Hold the current shortlist while the next term resolves, rather than
    // blanking the listbox between keystrokes.
    placeholderData: keepPreviousData,
    staleTime: Number.POSITIVE_INFINITY,
    // A failed candidate load is reported, not retried: `failed` is what stops
    // the listbox reporting "no matches" for a request that never landed, and
    // the default two retries would delay that answer by two round trips.
    retry: false,
    refetchOnWindowFocus: false,
  })

  return {
    term,
    setTerm,
    candidates: query.data?.pages.flatMap((page) => page.candidates) ?? [],
    loading: query.isPending || query.isFetching,
    failed: query.isError,
    hasMore: query.hasNextPage,
    total: query.data?.pages.at(-1)?.total,
    loadMore: () => {
      void query.fetchNextPage()
    },
  }
}
