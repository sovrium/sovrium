/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, useState } from 'react'
import type { TableRecord } from '../shared/types'

/**
 * Cursor-driven "load more" for a system read endpoint.
 *
 * A cursor feed answers one question — "give me the rows after this token" —
 * and reports NO total. That makes it the opposite shape from the page-number
 * paging the grid already had: there is no page count to draw a pager from, no
 * way back to a previous page except by re-reading from the start, and no
 * honest "x of N" to display. What there IS, on every response, is a
 * continuation token; so the surface a cursor feed supports is a CONTINUATION —
 * fetch the next page and APPEND it to the rows already on screen.
 *
 * ## Why append rather than replace
 *
 * Replacing is what a pager does, and it is wrong here because a cursor cannot
 * go back: swapping page 1 for page 2 would put the reader's first five rows
 * beyond reach for the rest of the session. Appending also makes the rows the
 * operator has already read stay exactly where they were, which is the only
 * thing that distinguishes a continuation from a re-query that happens to
 * return more rows.
 *
 * ## Why the accumulation lives OUTSIDE the query cache
 *
 * The cursor is part of the request, so it is part of the TanStack query key,
 * so each page is its own cache entry holding only its own rows. Something has
 * to remember the pages already shown, and it cannot be the entry for the page
 * in flight. This hook is that memory: `carried` holds every page confirmed
 * before the current one, and the query supplies only the current one.
 *
 * ## Why it resets on the feed key
 *
 * A cursor is only meaningful against the query that produced it. Change the
 * search term, the sort or a filter and the server is enumerating a DIFFERENT
 * sequence, so both the token and the rows accumulated under the old one stop
 * being answers to the question now being asked. Feeding them forward is how a
 * "load more" silently becomes a mixture of two result sets.
 *
 * The reset is a READ, not a write: a state entry whose `feedKey` no longer
 * matches is simply not read, and the next continuation overwrites it. That
 * avoids both an effect (which would paint one frame of the stale rows under
 * the new feed) and a set-state-during-render.
 */

interface CursorPageState {
  /** Identity of the feed these pages belong to — see the reset rationale above. */
  readonly feedKey: string
  /** Token the NEXT request should resume from; absent while on the first page. */
  readonly cursor?: string
  /** Every page confirmed before the one currently in the query cache. */
  readonly carried: readonly TableRecord[]
}

/**
 * The state read when the remembered pages belong to a feed that is no longer
 * the active one. A module constant so `carried` keeps a stable identity across
 * renders — it is fed to `useMemo` dependencies downstream, and a fresh `[]`
 * each render would invalidate them on every paint.
 */
const NO_PAGES: CursorPageState = { feedKey: '', carried: [] }

export interface SystemCursorPages {
  /** Continuation token for the request the grid should now make, if any. */
  readonly cursor?: string
  /** Rows from every previously confirmed page, in the order they were served. */
  readonly carried: readonly TableRecord[]
  /**
   * Advance to the next page: remember the page currently on screen and ask for
   * the one after it. Called with the token the CURRENT response carried, so a
   * grid can never continue from a cursor the server did not hand it.
   */
  readonly loadMore: (nextCursor: string, pageRecords: readonly TableRecord[]) => void
}

/**
 * @param feedIdentity everything that decides WHICH sequence the endpoint is
 *   walking — serialised here rather than by the caller so the identity and the
 *   comparison cannot be spelled two different ways. A falsy value (a grid that
 *   pages by number and never enters this path) collapses to the same inert key.
 */
export function useSystemCursorPages(feedIdentity: unknown): SystemCursorPages {
  const feedKey = feedIdentity ? JSON.stringify(feedIdentity) : ''
  const [state, setState] = useState<CursorPageState>(NO_PAGES)
  const active = state.feedKey === feedKey ? state : NO_PAGES

  const loadMore = useCallback(
    (nextCursor: string, pageRecords: readonly TableRecord[]) => {
      setState((prev) => ({
        feedKey,
        cursor: nextCursor,
        // `prev` rather than the captured `active`: two clicks landing in one
        // batch must both accumulate, and the guard re-checks the feed because
        // the key can change between the click and the update being applied.
        carried: prev.feedKey === feedKey ? [...prev.carried, ...pageRecords] : [...pageRecords],
      }))
    },
    [feedKey]
  )

  return { cursor: active.cursor, carried: active.carried, loadMore }
}

/**
 * Splice the page held by the query onto the pages already carried.
 *
 * `isStale` is the whole subtlety. A continuation changes the query key, and
 * the grid keeps the previous entry on screen while the new one loads
 * (`placeholderData: keepPreviousData`) so an interaction never blanks the
 * rows. But that placeholder IS the page just carried, so appending it would
 * render every row of it twice for the duration of the flight. While the data
 * is stale the carried rows are therefore the whole answer — which is also
 * exactly what the operator was already looking at, so nothing moves.
 */
export function joinCursorPages(
  carried: readonly TableRecord[],
  pageRecords: readonly TableRecord[],
  isStale: boolean
): readonly TableRecord[] {
  if (carried.length === 0) return pageRecords
  return isStale ? carried : [...carried, ...pageRecords]
}

/** The page a rows-envelope response contributes to a cursor feed. */
interface CursorFeedPage {
  readonly records?: readonly TableRecord[]
  readonly nextCursor?: string
  /** The endpoint's own count, where it reports one — a cursor feed does not. */
  readonly total?: number
}

export interface CursorFeedView {
  /** Every page the operator has asked for, oldest first. */
  readonly records: readonly TableRecord[]
  /**
   * The grid is reading a CURSOR feed rather than a numbered one.
   *
   * True from the first response that carries a continuation, and it STAYS true
   * once pages have been carried — including at the end of the feed, where the
   * last response reports no cursor but the rows on screen are an accumulation
   * no page number describes.
   *
   * This is what suppresses the pager and its "x–y of N". A cursor envelope
   * reports no total, so a pager could only invent one from the page length —
   * which is exactly what it did: 30 seeded runs behind a 25-row window rendered
   * as "1–25 of 25", beside "Page 1 of 1" and a permanently disabled Next.
   * Three simultaneous wrong answers, all of them telling the operator the rows
   * they cannot see do not exist.
   */
  readonly cursorPaged: boolean
  /** The endpoint says more rows follow — derived from the response, never config. */
  readonly hasMore: boolean
  /** A continuation is in flight. */
  readonly isLoadingMore: boolean
  readonly onLoadMore: () => void
  /**
   * How many records the grid should report it holds.
   *
   * On a cursor feed the response's own `total` describes the LAST page alone —
   * the envelope has none to give — so the only honest count is what is on
   * screen. Everywhere else the server's count still wins, because it describes
   * the whole view rather than the loaded page.
   */
  readonly total: number
}

/** A response that has not landed yet — a module constant for dependency stability. */
const NO_RECORDS: readonly TableRecord[] = []

/**
 * Join the carried pages to the one the query holds, and expose the
 * continuation affordance's state.
 *
 * The pair splits around the query because the cursor is an INPUT to it and the
 * next cursor an OUTPUT of it: {@link useSystemCursorPages} runs before the
 * fetch to supply the token, this runs after to consume the answer.
 */
export function useCursorFeedView(
  pages: SystemCursorPages,
  page: CursorFeedPage | undefined,
  isStale: boolean
): CursorFeedView {
  const pageRecords = page?.records ?? NO_RECORDS
  const nextCursor = page?.nextCursor
  const { carried, loadMore } = pages

  const records = useMemo(
    () => joinCursorPages(carried, pageRecords, isStale),
    [carried, pageRecords, isStale]
  )

  // Guarded twice over: it continues only from a token the CURRENT response
  // carried, and never while that response is the stale placeholder for a
  // continuation already in flight — carrying the placeholder would append the
  // page just carried a second time.
  const onLoadMore = useCallback(() => {
    if (nextCursor === undefined || isStale) return
    loadMore(nextCursor, pageRecords)
  }, [nextCursor, pageRecords, isStale, loadMore])

  const cursorPaged = nextCursor !== undefined || carried.length > 0
  return {
    records,
    cursorPaged,
    hasMore: nextCursor !== undefined,
    isLoadingMore: isStale,
    onLoadMore,
    total: cursorPaged ? records.length : (page?.total ?? 0),
  }
}
