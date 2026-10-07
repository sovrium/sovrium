/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  toApiConditions,
  buildSortParam,
  RECORDS_PAGE_SIZE,
  retryUnlessRateLimited,
  retryUnlessAnswered,
  fetchTableRecords,
} from '../runtime/records-api'
import { fetchSystemEndpoint } from './use-system-source-fetch'
import type { LazySharedRequest } from './use-lazy-shared-filter'
import type { LiveRefreshSource } from './use-realtime-subscription'
import type { SharedFilterBindingConfig } from './use-shared-filter'
import type { FetchResult } from './use-system-source-fetch'
import type { SharedRecordsParams } from '../runtime/shared-filter-param'
import type { TableRecord } from '../runtime/types'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'

/**
 * Shared single-page records query for the list-family data components
 * (gallery / kanban / calendar / timeline / list).
 *
 * These components all render their rows up-front (a card grid, kanban columns,
 * calendar cells, a time axis, a `<ul>`) rather than paginating client-side, so
 * they share ONE fetch shape: request a large single page and normalize it to
 * `{ records, total }`. Each component used to inline a byte-identical copy of
 * the param-builders + DB-table fetch + the `useQuery` body, differing only in
 * its query-key prefix; this module is the single source of truth they now all
 * consume.
 *
 * Two bindings are supported (mutually exclusive):
 *  - `dataSource.table` → the DB-table records API (`/api/tables/:t/records`),
 *    flattening each record's `fields` onto the top level — or, with
 *    `dataSource.view`, the view's records route (`/api/tables/:t/views/:v/records`),
 *    which applies the view's filter, sort and fields on the server;
 *  - `dataSource.system` → a named system READ endpoint via the shared
 *    `fetchSystemEndpoint` (the CAP-1 runtime root) — read-only, no writes.
 *
 * Each component keeps its OWN row→view mapping local (card / event / column /
 * item builders); this hook only owns the fetch + envelope normalization.
 */

// Re-exported so consumers can type the query result without reaching into the
// system-source fetch module (the canonical home of `FetchResult`).
export type { FetchResult }

/** Translate domain filters to the records-API `{ and: [...] }` JSON param. */
export function buildFilterParam(filters: readonly DataFilter[] | undefined): string | undefined {
  const conditions = toApiConditions(filters)
  return conditions.length === 0 ? undefined : JSON.stringify({ and: conditions })
}

// ---------------------------------------------------------------------------
// Data source shape + page size
// ---------------------------------------------------------------------------

/**
 * The data-source shape shared by the list-family components: a DB-table OR a
 * system read-endpoint binding, with optional schema-driven filter / sort.
 * `view` reads the table through one of its declared views; the view then owns
 * the filter and the sort, so a binding carries `view` OR its own conditions.
 */
export interface RecordsDataSource extends SharedFilterBindingConfig, LiveRefreshSource {
  /** DB-table binding — ABSENT for a system-source binding. */
  readonly table?: string
  /**
   * System read-endpoint binding (CAP-1). When present, rows come from
   * `system.endpoint` (+ `system.query`) via the shared system-source fetch
   * instead of the DB-table records API. Mutually exclusive with `table`.
   */
  readonly system?: SystemSource
  readonly view?: string
  readonly filter?: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
  /**
   * How many records ONE page holds, for the views that page. Absent means the
   * whole set in one request, which is what a view rendering every row up-front
   * wants.
   *
   * This is the binding's declared `limit`, and it used to reach nothing: the
   * fetch hard-coded the large page size below, so a list asking for two rows
   * received a hundred and any "load more" control had nothing left to load.
   *
   * It is read by {@link useRecordsPagesQuery}, which is the documented
   * contract: "`dataSource.limit` sets how many records the first page holds,
   * and each press of Load More appends another page of that size", and by a
   * single-page view that opts into a bounded fetch: the gallery draws no more
   * cards than its `limit`, the first ones in its sort order. The other
   * single-page views — calendar, kanban, timeline — draw every row they
   * receive and offer no way to ask for more, so honouring a `limit` there
   * would truncate the view with nothing to reveal the rest.
   */
  readonly limit?: number
}

/**
 * The page size a binding actually asks for, bounded by what the server accepts.
 *
 * The records route REFUSES a `?limit=` above its ceiling with a 400 rather than
 * clamping — deliberately, so an API caller walking pages with `offset += limit`
 * is never silently served a narrower page than the arithmetic it is doing (see
 * `routes/tables/validation/pagination-validation.ts`). That reasoning is about
 * a caller doing its own paging. This hook IS the pager, and it walks with the
 * size it asked for, so the bound belongs here, where the request is built: a
 * binding naming more records per page than the server will serve then gets
 * smaller pages, instead of a view that renders its error state. `AppSchema`
 * accepts any positive integer for `limit`, so the value genuinely can exceed
 * the ceiling.
 */
const resolvePageSize = (dataSource: RecordsDataSource | undefined): number =>
  dataSource?.limit !== undefined && dataSource.limit > 0
    ? Math.min(Math.floor(dataSource.limit), RECORDS_PAGE_SIZE)
    : RECORDS_PAGE_SIZE

// ---------------------------------------------------------------------------
// One page, whichever binding it comes from
// ---------------------------------------------------------------------------

/** A binding reduced to the values one page request depends on. */
interface PageRequest {
  readonly system: SystemSource | undefined
  readonly table: string | undefined
  readonly view: string | undefined
  readonly sortParam: string | undefined
  readonly filterParam: string | undefined
  /** Params a shared-filter publisher contributes beside the filter. */
  readonly extraParams: Readonly<Record<string, string>>
  readonly pageSize: number
}

/**
 * Reduce a binding to one page request. `pageSize` is passed in rather than read
 * off the binding, because the two hooks below answer that question differently
 * and the difference is the whole contract: only the paging hook spends the
 * declared `limit` (see the field's own note above).
 */
const buildPageRequest = (
  dataSource: RecordsDataSource | undefined,
  pageSize: number,
  shared: SharedRecordsParams
): PageRequest => ({
  system: dataSource?.system,
  table: dataSource?.table,
  view: dataSource?.view,
  sortParam: buildSortParam(dataSource?.sort),
  filterParam: shared.filterParam,
  extraParams: shared.extraParams,
  pageSize,
})

/**
 * The request of a view bound to no shared-filter channel: its own filter and
 * nothing else. A view bound to one passes the request its channel builds
 * (`useLazySharedFilter`) — that hook lives apart so the views that never
 * bind (a record drawer, a picker, a single record) do not load it.
 */
const unboundRequest = (dataSource: RecordsDataSource | undefined): LazySharedRequest => ({
  filterParam: buildFilterParam(dataSource?.filter),
  extraParams: {},
  ready: true,
})

/** A binding is present, so the query has somewhere to fetch from. */
const isBound = (request: PageRequest): boolean => Boolean(request.system) || Boolean(request.table)

/**
 * The cache key for a binding.
 *
 * A system source is keyed by its endpoint AND its static query, so two
 * components on one endpoint asking different questions never share an answer.
 * `pageSize` is in both shapes because it changes what comes back — two lists
 * on one table asking for different page sizes must not share the smaller one.
 */
const buildPageQueryKey = (prefix: string, request: PageRequest): readonly unknown[] =>
  request.system
    ? [
        `${prefix}-system`,
        // The whole binding: `rowsKey` / `idKey` / `totalKey` shape the
        // normalised answer, and the page's islands share one cache.
        request.system,
        request.sortParam,
        request.pageSize,
      ]
    : [
        prefix,
        request.table,
        request.view,
        request.filterParam,
        request.sortParam,
        request.pageSize,
        request.extraParams,
      ]

/** Fetch page `pageIndex` from whichever binding the request names. */
const fetchRecordsPage = (request: PageRequest, pageIndex: number): Promise<FetchResult> => {
  const { system, table, view, sortParam, filterParam, extraParams, pageSize } = request
  // System source: fetch the read endpoint and normalize its rows envelope.
  if (system) return fetchSystemEndpoint({ system, pagination: { pageIndex, pageSize }, sortParam })
  if (!table) return Promise.resolve({ records: [], total: 0 })
  return fetchTableRecords({
    table,
    view,
    sortParam,
    filterParam,
    extraParams,
    pageIndex,
    pageSize,
  })
}

// ---------------------------------------------------------------------------
// Records query hook
// ---------------------------------------------------------------------------

/**
 * Fetch one page of records for a list-family component.
 *
 * `keyPrefix` namespaces the TanStack query key per component (e.g. `'gallery'`,
 * `'kanban'`) so two components on the same endpoint never share a cache entry.
 * With a `dataSource.system` binding the rows come from the named read endpoint;
 * otherwise from the DB-table records API. The query is disabled until a binding
 * is present.
 */
export function useRecordsQuery(
  keyPrefix: string,
  dataSource: RecordsDataSource | undefined,
  shared: LazySharedRequest = unboundRequest(dataSource),
  bounded = false
): UseQueryResult<FetchResult> {
  // One page big enough to hold the whole set — these callers render every row
  // they receive and offer no control that could fetch a second page — unless
  // the view is `bounded` by its declared `limit`.
  const pageSize = bounded ? resolvePageSize(dataSource) : RECORDS_PAGE_SIZE
  const request = buildPageRequest(dataSource, pageSize, shared)

  return useQuery({
    queryKey: buildPageQueryKey(`${keyPrefix}-records`, request),
    // Held until a bound channel has been read, so the first request is the
    // filtered one rather than everything followed by a re-fetch.
    enabled: isBound(request) && shared.ready,
    retry: retryUnlessAnswered,
    queryFn: (): Promise<FetchResult> => fetchRecordsPage(request, 0),
    // A changed key (a filter, a sort) keeps the rows on screen until the new
    // answer lands, rather than dropping the view back to its skeleton.
    placeholderData: keepPreviousData,
  })
}

// ---------------------------------------------------------------------------
// Paged records query — one page at a time, kept and appended
// ---------------------------------------------------------------------------

/**
 * The index of the page after the ones already fetched, or `undefined` when
 * there is nothing left.
 *
 * A page that came back EMPTY ends the walk whatever the reported total claims:
 * an endpoint whose count disagrees with its rows must not spin forever.
 */
const nextPageIndex = (last: FetchResult, all: readonly FetchResult[]): number | undefined => {
  const loaded = all.reduce((sum, page) => sum + page.records.length, 0)
  if (last.records.length === 0 || loaded >= last.total) return undefined
  return all.length
}

/** What a paged view needs: the rows so far, and whether there are more. */
export interface RecordsPages {
  readonly records: readonly TableRecord[]
  readonly total: number
  /** The FIRST page is in flight, so there is nothing to render yet. */
  readonly isLoading: boolean
  readonly isError: boolean
  readonly error: unknown
  /** More rows exist beyond the ones already fetched. */
  readonly hasMore: boolean
  /**
   * A LATER page is in flight, with earlier pages already on screen.
   *
   * Distinct from `isLoading`, and a view showing a "load more" control needs
   * exactly this one: by the time that control is on screen the first page has
   * resolved, so `isLoading` is false and can never become true again. Reporting
   * progress from `isLoading` therefore yields a control that is permanently
   * idle no matter how long a page takes.
   */
  readonly isLoadingMore: boolean
  /** Fetch the next page and APPEND it to the rows already rendered. */
  readonly loadMore: () => void
  /** Ask again after a failed read — what a rate-limited view's Retry spends. */
  readonly retry: () => void
}

/**
 * The accumulating sibling of {@link useRecordsQuery}: fetches ONE page at a
 * time and keeps the pages it has already fetched.
 *
 * `useRecordsQuery` requests a whole set in a single call, which is right for a
 * view that draws every row up-front. A view offering "load more" needs the
 * other shape — an initial page bounded by the binding's `limit`, and a way to
 * ask for the next one WITHOUT re-transferring what is already on screen. That
 * last clause is why this is an infinite query rather than a widening single
 * one: re-requesting page 1 with a bigger limit renders the same thing and
 * costs the whole set again on every click.
 *
 * `hasMore` is derived from the reported total rather than from a full last
 * page, so a set whose size is an exact multiple of the page size does not
 * offer one final click that loads nothing.
 */
export function useRecordsPagesQuery(
  keyPrefix: string,
  dataSource: RecordsDataSource | undefined,
  shared: LazySharedRequest = unboundRequest(dataSource)
): RecordsPages {
  const request = buildPageRequest(dataSource, resolvePageSize(dataSource), shared)

  const query = useInfiniteQuery({
    queryKey: buildPageQueryKey(`${keyPrefix}-record-pages`, request),
    enabled: isBound(request) && shared.ready,
    retry: retryUnlessRateLimited,
    initialPageParam: 0,
    queryFn: ({ pageParam }): Promise<FetchResult> => fetchRecordsPage(request, pageParam),
    getNextPageParam: nextPageIndex,
    // Same as `useRecordsQuery`: a changed key keeps the rows already shown.
    placeholderData: keepPreviousData,
  })

  // `fetchNextPage` resolves with the whole query result; nothing here awaits
  // it, and an in-flight page is already reported through `query`. The wrapper
  // exists so the caller's `onClick` is a plain void handler rather than a
  // floating promise every call site would have to void separately.
  const { fetchNextPage, refetch } = query
  const loadMore = useCallback(() => {
    void fetchNextPage()
  }, [fetchNextPage])
  const retry = useCallback(() => {
    void refetch()
  }, [refetch])

  const pages = query.data?.pages ?? []
  return {
    records: pages.flatMap((page) => page.records),
    total: pages.at(-1)?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore,
    retry,
  }
}
