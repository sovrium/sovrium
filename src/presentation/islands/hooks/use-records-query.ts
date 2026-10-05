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
import { MAX_PAGE_SIZE } from '@/domain/kernel/sql/page-window'
import { createRecordsClient } from '@/presentation/api/client'
import { fetchSystemEndpoint, fetchSystemDetailEndpoint } from './use-system-source-fetch'
import type { LazySharedRequest } from './use-lazy-shared-filter'
import type { SharedFilterBindingConfig } from './use-shared-filter'
import type { FetchResult } from './use-system-source-fetch'
import type { SharedRecordsParams } from '../runtime/shared-filter-param'
import type { TableRecord } from '../runtime/types'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'
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
 *    flattening each record's `fields` onto the top level;
 *  - `dataSource.system` → a named system READ endpoint via the shared
 *    `fetchSystemEndpoint` (the CAP-1 runtime root) — read-only, no writes.
 *
 * Each component keeps its OWN row→view mapping local (card / event / column /
 * item builders); this hook only owns the fetch + envelope normalization.
 */

// Re-exported so consumers can type the query result without reaching into the
// system-source fetch module (the canonical home of `FetchResult`).
export type { FetchResult }

// ---------------------------------------------------------------------------
// API client (singleton)
// ---------------------------------------------------------------------------

const apiClient = createRecordsClient(typeof window !== 'undefined' ? window.location.origin : '')

// ---------------------------------------------------------------------------
// Filter / sort param translation
// ---------------------------------------------------------------------------

const DOMAIN_TO_API_OPERATOR: Record<string, string> = {
  eq: 'equals',
  neq: 'notEquals',
  gt: 'greaterThan',
  lt: 'lessThan',
  gte: 'greaterThanOrEqual',
  lte: 'lessThanOrEqual',
  contains: 'contains',
}

/**
 * Domain filters as records-API CONDITIONS, before they are wrapped.
 *
 * Exported beside {@link buildFilterParam} because one consumer needs the
 * leaves rather than the finished param: the record picker MERGES the author's
 * conditions with its own search condition into a single `and` group, and
 * re-deriving the operator translation on its side would be a second copy of
 * this table — the exact drift the shared picker modules exist to prevent.
 */
export function toApiConditions(
  filters: readonly DataFilter[] | undefined
): readonly Readonly<Record<string, unknown>>[] {
  if (!filters || filters.length === 0) return []
  return filters.map((f) => ({
    field: f.field,
    operator: DOMAIN_TO_API_OPERATOR[f.operator] ?? f.operator,
    value: f.value,
  }))
}

/** Translate domain filters to the records-API `{ and: [...] }` JSON param. */
export function buildFilterParam(filters: readonly DataFilter[] | undefined): string | undefined {
  const conditions = toApiConditions(filters)
  return conditions.length === 0 ? undefined : JSON.stringify({ and: conditions })
}

/** Translate domain sorts to the records-API `field:direction,…` param. */
export function buildSortParam(sort: readonly DataSort[] | undefined): string | undefined {
  if (!sort || sort.length === 0) return undefined
  return sort.map((s) => `${s.field}:${s.direction}`).join(',')
}

// ---------------------------------------------------------------------------
// Data source shape + page size
// ---------------------------------------------------------------------------

/**
 * The data-source shape shared by the list-family components: a DB-table OR a
 * system read-endpoint binding, with optional schema-driven filter / sort.
 * `view` is carried for parity with richer components but is not used by the
 * single-page fetch.
 */
export interface RecordsDataSource extends SharedFilterBindingConfig {
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
   * It is read by {@link useRecordsPagesQuery} ONLY, which is the documented
   * contract: "`dataSource.limit` sets how many records the first page holds,
   * and each press of Load More appends another page of that size". The
   * single-page views — calendar, gallery, kanban, timeline — draw every row
   * they receive and offer no way to ask for more, so honouring a `limit` there
   * would truncate the view with nothing to reveal the rest. The gallery is the
   * clearest case: it pages CLIENT-side over the rows already fetched, so a
   * `limit` applied to its fetch would cap what its own Load More can ever
   * reach.
   */
  readonly limit?: number
}

/**
 * Request size when a binding declares no `limit` of its own — and the largest
 * page the records API will serve.
 *
 * It IS the server's ceiling, read from the dependency-free kernel constant
 * rather than repeated: the copy that used to stand here could drift from the
 * server, and the kernel module pulls in nothing a client chunk would pay for.
 */
export const RECORDS_PAGE_SIZE = MAX_PAGE_SIZE

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
// DB-table fetch
// ---------------------------------------------------------------------------

/**
 * Everything one page request needs. An object rather than five positional
 * arguments: `sortParam` and `filterParam` are both optional strings and sit
 * next to each other, so a transposed pair would typecheck and quietly filter
 * by the sort expression.
 */
interface TablePageRequest {
  readonly table: string
  readonly sortParam: string | undefined
  readonly filterParam: string | undefined
  /** Params a shared-filter publisher contributes beside the filter. */
  readonly extraParams: Readonly<Record<string, string>>
  /** Zero-based; the records API counts pages from one. */
  readonly pageIndex: number
  readonly pageSize: number
}

/**
 * The statuses with which the records API REFUSES a read: not signed in (401),
 * not allowed (403), or — the anti-enumeration answer for a table the reader
 * may not know about — not found (404).
 */
const REFUSED_READ_STATUSES: ReadonlySet<number> = new Set([401, 403, 404])

/** The HTTP status a failed read carried on its `cause`, when it got a response. */
const readStatus = (error: unknown): unknown =>
  error instanceof Error
    ? (error.cause as { readonly status?: unknown } | undefined)?.status
    : undefined

/**
 * Whether a records query failed because the reader may not read the table,
 * as opposed to a fault. A refusal is an ANSWER: asking again returns it
 * again, and a surface shown to a visitor who may not read a table has nothing
 * of that table to show — which is what an empty read already says, without
 * telling the visitor the table exists.
 */
export function isRefusedRead(error: unknown): boolean {
  const status = readStatus(error)
  return typeof status === 'number' && REFUSED_READ_STATUSES.has(status)
}

/**
 * The island QueryClient's two retries, withheld from a read refused with 429:
 * it is not worth asking again before its `Retry-After`, and asking at once
 * only spends the budget and holds the view empty for the length of the
 * backoff. The view offers its own Retry instead (`RateLimitedNotice`). This
 * module keeps its own copy of the rule so the many islands that read through
 * it do not each pay for the notice.
 */
const retryUnlessRateLimited = (failureCount: number, error: Error): boolean =>
  readStatus(error) !== 429 && failureCount < 2

/** {@link retryUnlessRateLimited}, also withheld from a refused read, which is answered, not failed. */
const retryUnlessAnswered = (failureCount: number, error: Error): boolean =>
  !isRefusedRead(error) && retryUnlessRateLimited(failureCount, error)

/** Fetch one page of DB-table records and flatten `record.fields` to the top level. */
async function fetchTableRecords({
  table,
  sortParam,
  filterParam,
  extraParams,
  pageIndex,
  pageSize,
}: TablePageRequest): Promise<FetchResult> {
  const query = {
    ...extraParams,
    page: String(pageIndex + 1),
    limit: String(pageSize),
    ...(sortParam && { sort: sortParam }),
    ...(filterParam && { filter: filterParam }),
  }

  const res = await apiClient.api.tables[':tableId'].records.$get({
    param: { tableId: table },
    query,
  })

  if (!res.ok) {
    const body = await res.text()
    // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
    throw new Error(`Failed to fetch records: ${String(res.status)} ${body}`, {
      cause: { status: res.status },
    })
  }

  const json = (await res.json()) as {
    records?: readonly (TableRecord & { fields?: TableRecord })[]
    total?: number
    pagination?: { total?: number }
  }

  // Flatten: merge record.fields into top-level.
  const rawRecords = json.records ?? []
  const flatRecords: readonly TableRecord[] = rawRecords.map((r) => {
    const { fields, ...rest } = r
    return { ...rest, ...(fields ?? {}) }
  })

  return {
    records: flatRecords,
    total: json.total ?? json.pagination?.total ?? rawRecords.length,
  }
}

// ---------------------------------------------------------------------------
// One page, whichever binding it comes from
// ---------------------------------------------------------------------------

/** A binding reduced to the values one page request depends on. */
interface PageRequest {
  readonly system: SystemSource | undefined
  readonly table: string | undefined
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
        request.filterParam,
        request.sortParam,
        request.pageSize,
        request.extraParams,
      ]

/** Fetch page `pageIndex` from whichever binding the request names. */
const fetchRecordsPage = (request: PageRequest, pageIndex: number): Promise<FetchResult> => {
  const { system, table, sortParam, filterParam, extraParams, pageSize } = request
  // System source: fetch the read endpoint and normalize its rows envelope.
  if (system) return fetchSystemEndpoint({ system, pagination: { pageIndex, pageSize }, sortParam })
  if (!table) return Promise.resolve({ records: [], total: 0 })
  return fetchTableRecords({ table, sortParam, filterParam, extraParams, pageIndex, pageSize })
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
  shared: LazySharedRequest = unboundRequest(dataSource)
): UseQueryResult<FetchResult> {
  // One page big enough to hold the whole set, always — these callers render
  // every row they receive and offer no control that could fetch a second page.
  const request = buildPageRequest(dataSource, RECORDS_PAGE_SIZE, shared)

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

// ---------------------------------------------------------------------------
// Single-record (detail) query — CAP-2
// ---------------------------------------------------------------------------

/**
 * The single-record counterpart to `RecordsDataSource`: a record-bound
 * component's `dataSource` shape. `system` (a detail-endpoint binding) is the
 * client-fetching variant this hook serves; the DB-table single-record path
 * (`{ table, mode: single, param }`) is resolved SERVER-side and is left
 * intact — this hook never touches it.
 */
export interface RecordDataSource {
  /** DB-table single-record binding — resolved server-side, NOT fetched here. */
  readonly table?: string
  readonly mode?: string
  readonly param?: string
  /** System detail-endpoint binding (CAP-2) — the client-fetching variant. */
  readonly system?: SystemDetailSource
}

/**
 * Fetch ONE record for a record-bound component from a system DETAIL endpoint.
 *
 * The sibling of `useRecordsQuery` (rows) for SINGLE records: with a
 * `dataSource.system` binding the record comes from a named detail endpoint —
 * `id` injected into the `:param` slot — via the shared `fetchSystemDetailEndpoint`
 * (reusing the same credentialed fetch the rows path uses). The query is disabled
 * until BOTH a system binding and a record id are present. `keyPrefix` namespaces
 * the cache key per consuming island so two components on the same endpoint never
 * collide. The DB-table single-record path stays server-resolved and is untouched.
 */
export function useRecordQuery(
  keyPrefix: string,
  dataSource: RecordDataSource | undefined,
  id: string | undefined
): UseQueryResult<TableRecord | undefined> {
  const system = dataSource?.system
  return useQuery({
    // The whole binding: `recordKey` and the `:param` slot shape the answer.
    queryKey: [`${keyPrefix}-system-detail`, system, id],
    enabled: Boolean(system) && Boolean(id),
    queryFn: (): Promise<TableRecord | undefined> =>
      system && id ? fetchSystemDetailEndpoint(system, id) : Promise.resolve(undefined),
  })
}
