/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { QueryClient } from '@tanstack/react-query'

/**
 * Creates a QueryClient instance for an island root.
 *
 * Each island gets its own QueryClient to ensure isolation —
 * cache invalidation in one island doesn't cause unnecessary
 * refetches in unrelated islands.
 */
export function createIslandQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 2,
        refetchOnWindowFocus: true,
      },
    },
  })
}

/**
 * Options that make a `useQuery` behave like the hand-rolled
 * `useEffect` + `fetch` + `useState` reads it replaced.
 *
 * The island QueryClient's defaults are `retry: 2` and
 * `refetchOnWindowFocus: true` — deliberately, for the data surfaces that were
 * written against them. A read that used to be a bare effect had NEITHER: it
 * fired once, and a failure was final. Migrating such a read without pinning
 * these two would silently change two observable behaviours — a failure state
 * would appear three requests late, and returning to the tab would re-issue a
 * request the surface never used to make.
 *
 * `staleTime: Infinity` completes the shape: the effect ran on mount and never
 * again, so nothing may re-fetch it on a remount either.
 */
export const READ_ONCE_QUERY_OPTIONS = {
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
  refetchOnWindowFocus: false,
} as const

/**
 * Adapt a reader that reports "nothing / could not ask" as `undefined` into one
 * a query can hold.
 *
 * TanStack REJECTS an `undefined` query result outright ("Query data cannot be
 * undefined"), because it cannot tell that value apart from a query function
 * that forgot to return. Several island readers use `undefined` as a legitimate
 * resolved value — no signed-in operator, no version to show, a search the
 * server refused — and for those it is data, not a failure: the surface renders
 * its absent state and asks again for nothing.
 *
 * Mapping to `null` at the query boundary keeps that meaning without the
 * rejection, and callers map straight back with `?? undefined`.
 */
export const nullable =
  <T>(read: () => Promise<T | undefined>) =>
  async (): Promise<T | null> =>
    // eslint-disable-next-line unicorn/no-null -- `null` is the only absent value TanStack will hold; `undefined` is rejected as a missing return
    (await read()) ?? null
