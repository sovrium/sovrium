/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { QueryClient } from '@tanstack/react-query'

/**
 * Creates a fresh QueryClient.
 *
 * In the browser, islands do NOT call this directly: they share the page's
 * client through {@link getPageQueryClient}. It stays for server-side renders
 * (a field specimen rendered to a string), where one client per render is the
 * only safe scope — a module-level client on the server would be shared by
 * every request the process answers.
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

/** The page's one client, created on first use. */
// eslint-disable-next-line functional/no-let -- the lazily created, resettable page singleton
let pageQueryClient: QueryClient | undefined

/**
 * The QueryClient every island mounted on this page shares.
 *
 * One client per page is what lets two islands asking the same question — four
 * KPI tiles over one endpoint, two grids over the same rows — share one request
 * and one cached answer, and what lets a write made through one island refresh
 * every other island showing the same data.
 *
 * Sharing is safe because no island clears the cache wholesale: every
 * `invalidateQueries` / `resetQueries` in the island tree names a `queryKey`
 * (held by `query-client-key-guard.test.ts`), and cross-island refreshes that
 * are not about the same query still travel on the event bus.
 *
 * Browser-only: never call this during a server render.
 */
export function getPageQueryClient(): QueryClient {
  pageQueryClient ??= createIslandQueryClient()
  return pageQueryClient
}

/**
 * Mark every cached answer no mounted island is still reading as stale.
 * Called when a client-side navigation replaces the page's content, right
 * after the outgoing surface's islands unmounted.
 *
 * Stale, not dropped. A swapped-in surface that asks a question already
 * answered remounts from the cached answer — no skeleton — and refetches it in
 * the background, because an invalidated query refetches on mount regardless
 * of `staleTime`. That holds for the {@link READ_ONCE_QUERY_OPTIONS} readers
 * too, whose `staleTime: Infinity` would otherwise keep a revisited surface on
 * the answer it read the first time. Dropping them instead made every revisit
 * a cold load.
 *
 * Inactive queries only: the islands OUTSIDE the swapped region (the shell's
 * own) are still mounted and still reading theirs, and a navigation is no
 * reason to refetch what they show. Invalidating per query through the cache,
 * rather than `invalidateQueries`, is what keeps this a type-scoped call the
 * key guard (`query-client-key-guard.test.ts`) sanctions by name.
 */
export function staleInactivePageQueries(): void {
  pageQueryClient
    ?.getQueryCache()
    .findAll({ type: 'inactive' })
    .forEach((query) => query.invalidate())
}

/**
 * Options that make a `useQuery` behave like the hand-rolled
 * `useEffect` + `fetch` + `useState` reads it replaced.
 *
 * The page QueryClient's defaults are `retry: 2` and
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
