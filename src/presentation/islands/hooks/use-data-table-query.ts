/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createRecordsClient } from '@/presentation/api/client'
import { groupPathKey } from '../data-table/group-order'
import { fetchSystemEndpoint } from './use-system-source-fetch'
import type { FetchResult } from './use-system-source-fetch'
import type { SummaryAggregations } from '../data-table/summary-aggregate'
import type { TableRecord } from '../shared/types'
import type { DataTableSystemSource } from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SortingState, PaginationState } from '@tanstack/react-table'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Re-exported for backward compatibility: `FetchResult` now lives in the shared
// system-source fetch module (the CAP-1 runtime root reused by the list family).
export type { FetchResult }

/**
 * One page of records, plus the WHOLE-VIEW aggregates the summary footer needs.
 *
 * The aggregate rides the records request rather than a second one so the
 * footer's number lands in the same response as the rows it describes. A system
 * source has no aggregate endpoint, so `aggregations` is simply absent there.
 */
interface DataTableFetchResult extends FetchResult {
  readonly aggregations?: SummaryAggregations
  readonly groups?: readonly GroupCount[]
}

/**
 * One group of the WHOLE VIEW: its value, how many records carry it, and the
 * declared aggregates over those records. `aggregations` is present only when
 * the request also carried `?aggregate=` — i.e. when the grid declares a summary.
 */
export interface GroupCount {
  readonly name: string
  /**
   * The group's values from the outermost level down to its own. Absent only
   * from a response predating the nested-grouping contract, in which case the
   * group's own `name` IS its path (a one-level grid).
   */
  readonly path?: readonly string[]
  readonly count: number
  readonly aggregations?: SummaryAggregations
}

interface UseDataTableQueryParams {
  readonly table: string
  /**
   * System read-endpoint binding.
   * When present, the grid fetches `system.endpoint` (merging `system.query`
   * static params + the table's own sort/search params) instead of the DB-table
   * records API, and normalizes the `{ [rowsKey]: [...] }` envelope to
   * `{ records, total }`. Mutually exclusive with the DB-table `table` binding.
   */
  readonly system?: DataTableSystemSource
  /**
   * Dynamic query params from an EXTERNAL filter bar (system source only),
   * merged on top of the static `system.query`. Drives the page-level
   * automation / status filters of the converted runs directory
   *.
   */
  readonly systemQuery?: Record<string, string>
  /** Grid id (component `id`); a NAMED runs grid opts into status localization. */
  readonly sourceId?: string
  /**
   * Cross-component shared-filter params,
   * merged into the DB-table records request as raw query params (e.g. a sibling
   * publisher's value forwarded as `?status=`). Inert for the system-source path
   * (those merge via `systemQuery`). The records endpoint strips unknown keys, so
   * they ride along harmlessly server-side while staying observable on the request.
   */
  readonly sharedFilterParams?: Record<string, string>
  readonly pagination: PaginationState
  readonly sorting: SortingState
  readonly globalFilter: string
  /**
   * Whole-view aggregate request for the summary footer (`?aggregate=` JSON),
   * built from the grid's declared `summary`. Absent when the grid declares no
   * summary, in which case no aggregate SQL runs at all — see
   * `../data-table/summary-aggregate.ts`.
   */
  readonly aggregateParam?: string
  /**
   * Grouped field (`?groupBy=`) — or the comma-separated NESTED levels,
   * outermost first — so the response carries a whole-view record count per
   * group at every level. Rides the records request for the same reason
   * `aggregateParam` does: a group header's number describes the VIEW, and the
   * loaded page cannot witness it once a group spills past the page boundary.
   * Absent when the grid is not grouped, in which case no grouping runs at all.
   */
  readonly groupByParam?: string
  /** Optional schema-driven default filter (server-side, applied via ?filter= JSON) */
  readonly dataSourceFilter?: readonly DataFilter[]
  /** Optional schema-driven default sort (server-side, used when user has no sort applied) */
  readonly dataSourceSort?: readonly DataSort[]
  /**
   * Data refresh strategy. When `'poll'`, the query re-fetches on a fixed
   * interval (see `pollIntervalMs`). Any other value (or undefined) disables
   * automatic refresh.
   */
  readonly refreshMode?: 'none' | 'poll' | 'realtime'
  /**
   * Poll interval in milliseconds (only honored when `refreshMode` is
   * `'poll'`). Defaults to 30000 (30s) when polling and unspecified.
   */
  readonly pollIntervalMs?: number
}

/** Default poll interval (30s) when `refreshMode: 'poll'` and no interval given. */
const DEFAULT_POLL_INTERVAL_MS = 30_000

/**
 * Background re-fetch cadence for `refreshMode: 'realtime'`.
 *
 * Realtime mode is push-driven: an SSE `change` event invalidates the query
 * immediately when records are mutated through the API. This interval is only
 * a *resilience fallback* — it reconciles out-of-band changes (e.g. a direct
 * database write the SSE channel never sees) and bridges a dropped SSE
 * connection between reconnects.
 *
 * 3s balances two constraints: it catches an out-of-band DB write well within
 * a few seconds, while 20 record fetches/minute stays comfortably under the
 * 100-req/60s `GET:/api/tables/*` rate limit. (The SSE subscription endpoint
 * itself is exempt from that limiter — see `isRealtimeSubscriptionPath` in
 * `api-routes.ts` — so the only rate-limited realtime traffic is this poll.)
 */
const REALTIME_FALLBACK_POLL_MS = 3000

// ---------------------------------------------------------------------------
// API client (singleton, created once per browser context)
// ---------------------------------------------------------------------------

const apiClient = createRecordsClient(typeof window !== 'undefined' ? window.location.origin : '')

// ---------------------------------------------------------------------------
// Operator translation: domain → API
// ---------------------------------------------------------------------------

/**
 * Domain filter operators (eq, neq, gt, lt, gte, lte, contains) come from
 * `DataFilterSchema`. The records API expects a slightly different operator
 * vocabulary (equals, notEquals, greaterThan, ...). This map bridges them so
 * server-side filter conditions defined in `dataSource.filter` are honored.
 */
const DOMAIN_TO_API_OPERATOR: Record<string, string> = {
  eq: 'equals',
  neq: 'notEquals',
  gt: 'greaterThan',
  lt: 'lessThan',
  gte: 'greaterThanOrEqual',
  lte: 'lessThanOrEqual',
  contains: 'contains',
}

function buildFilterParam(filters: readonly DataFilter[] | undefined): string | undefined {
  if (!filters || filters.length === 0) return undefined
  const conditions = filters.map((f) => ({
    field: f.field,
    operator: DOMAIN_TO_API_OPERATOR[f.operator] ?? f.operator,
    value: f.value,
  }))
  return JSON.stringify({ and: conditions })
}

function buildDataSourceSortParam(sort: readonly DataSort[] | undefined): string | undefined {
  if (!sort || sort.length === 0) return undefined
  return sort.map((s) => `${s.field}:${s.direction}`).join(',')
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

interface FetchQuery {
  readonly table: string
  readonly pagination: PaginationState
  readonly sortParam?: string
  readonly globalFilter: string
  readonly filterParam?: string
  /** Whole-view aggregate request for the summary footer (`?aggregate=` JSON). */
  readonly aggregateParam?: string
  /** Grouped field (`?groupBy=`) — asks for the whole-view per-group counts. */
  readonly groupByParam?: string
  /** Raw cross-component shared-filter params appended to the records URL. */
  readonly sharedFilterParams?: Record<string, string>
}

/**
 * Drop empty-valued keys from a shared-filter param bag. The empty key is kept in
 * the query KEY (for cache-busting on a clear) but never sent as a bare `?k=`.
 */
function dropEmptyParams(params: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(params ?? {}).filter(([, value]) => value !== ''))
}

/** Build the records-API query string for one page fetch. */
function buildRecordsQuery(q: FetchQuery): Record<string, string> {
  return {
    page: String(q.pagination.pageIndex + 1),
    ...(q.pagination.pageSize && { limit: String(q.pagination.pageSize) }),
    ...(q.sortParam && { sort: q.sortParam }),
    ...(q.globalFilter && { q: q.globalFilter }),
    ...(q.filterParam && { filter: q.filterParam }),
    // Whole-view aggregates for the summary footer, computed in SQL over the
    // same filtered table the page is drawn from — so the footer describes the
    // view and stays put when the reader turns a page.
    ...(q.aggregateParam && { aggregate: q.aggregateParam }),
    // Whole-view per-group counts for the group headers, over the same filtered
    // table — so a header's count describes the view, not the loaded page.
    ...(q.groupByParam && { groupBy: q.groupByParam }),
    // Shared-filter binding params ride along as raw query params (e.g. a sibling
    // publisher's value forwarded as `?status=`). The records query schema strips
    // unknown keys, so they are inert server-side but observable on the request.
    ...dropEmptyParams(q.sharedFilterParams),
  }
}

/** Fetch one page of table records from the records API and flatten them. */
async function fetchTableRecords(fetchQuery: FetchQuery): Promise<DataTableFetchResult> {
  const res = await apiClient.api.tables[':tableId'].records.$get({
    param: { tableId: fetchQuery.table },
    query: buildRecordsQuery(fetchQuery),
  })

  if (!res.ok) {
    const body = await res.text()
    // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
    throw new Error(`Failed to fetch records: ${res.status} ${body}`)
  }

  const json = (await res.json()) as {
    records?: readonly (TableRecord & { fields?: TableRecord })[]
    total?: number
    pagination?: { total?: number }
    aggregations?: SummaryAggregations
    groups?: readonly GroupCount[]
  }
  // Flatten: merge record.fields into top-level for TanStack Table accessorKey resolution
  const rawRecords = json.records ?? []
  const flatRecords: readonly TableRecord[] = rawRecords.map((r) => {
    const { fields, ...rest } = r
    return { ...rest, ...(fields ?? {}) }
  })
  return {
    records: flatRecords,
    total: json.total ?? json.pagination?.total ?? rawRecords.length,
    ...(json.aggregations ? { aggregations: json.aggregations } : {}),
    ...(json.groups ? { groups: json.groups } : {}),
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Resolve the TanStack `refetchInterval` for the active refresh mode.
 *
 * Poll mode re-fetches on a fixed interval (TanStack natively pauses the timer
 * while the tab is hidden via the Page Visibility API and resumes on focus, and
 * clears it on unmount). Realtime mode is push-driven (SSE invalidations) and
 * uses a short interval only as a resilience fallback for out-of-band DB writes
 * and SSE reconnect gaps. Any other mode disables automatic refresh.
 */
function resolveRefetchInterval(
  refreshMode: UseDataTableQueryParams['refreshMode'],
  pollIntervalMs: number | undefined
): number | false {
  if (refreshMode === 'poll') return pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  if (refreshMode === 'realtime') return REALTIME_FALLBACK_POLL_MS
  return false
}

/** The resolved read params for one data-table fetch (system source OR DB table). */
interface ResolvedQuery {
  readonly table: string
  readonly system?: DataTableSystemSource
  readonly systemQuery?: Record<string, string>
  readonly sourceId?: string
  readonly sharedFilterParams?: Record<string, string>
  readonly pagination: PaginationState
  readonly sortParam?: string
  readonly globalFilter: string
  readonly filterParam?: string
  readonly aggregateParam?: string
  readonly groupByParam?: string
}

/**
 * Build the TanStack query key. The system-source key is endpoint-shaped (with
 * the static + dynamic query) so two grids on the same endpoint with different
 * params never share a cache entry; the DB-table key carries its filter +
 * shared-filter params so a publisher change re-keys (and re-reads) the grid.
 */
function buildQueryKey(q: ResolvedQuery, sortParam: string | undefined): readonly unknown[] {
  return q.system
    ? [
        'system-rows',
        q.system.endpoint,
        q.system.query,
        q.systemQuery,
        q.pagination,
        sortParam,
        q.globalFilter,
      ]
    : [
        'table-records',
        q.table,
        q.pagination,
        sortParam,
        q.globalFilter,
        q.filterParam,
        q.aggregateParam,
        q.groupByParam,
        q.sharedFilterParams,
      ]
}

/** Dispatch one fetch to the system endpoint OR the DB-table records API. */
function runDataTableFetch(q: ResolvedQuery): Promise<DataTableFetchResult> {
  return q.system
    ? fetchSystemEndpoint({
        system: q.system,
        systemQuery: q.systemQuery,
        sourceId: q.sourceId,
        pagination: q.pagination,
        sortParam: q.sortParam,
        globalFilter: q.globalFilter,
      })
    : fetchTableRecords({
        table: q.table,
        pagination: q.pagination,
        sortParam: q.sortParam,
        globalFilter: q.globalFilter,
        filterParam: q.filterParam,
        aggregateParam: q.aggregateParam,
        groupByParam: q.groupByParam,
        sharedFilterParams: q.sharedFilterParams,
      })
}

/**
 * Key the whole-view group answers by group PATH — the count that names each
 * group, and the declared aggregates over that group's rows.
 *
 * The path rather than the value, because a nested response carries a group per
 * level and a value alone stops identifying one: `["EMEA","Prospect"]` and
 * `["AMER","Prospect"]` are different sets, and keying both as `Prospect` would
 * silently let one overwrite the other's total.
 *
 * Normalised here rather than at the render site: the keyed shape belongs to the
 * response, and memoizing it once keeps the object references stable for the
 * props that carry them down to the group headers. Both maps are derived from
 * the same `groups` array in one place, so they cannot disagree about a group.
 */
function useGroupStats(groups: readonly GroupCount[] | undefined): {
  readonly groupCounts?: Readonly<Record<string, number>>
  readonly groupAggregations?: Readonly<Record<string, SummaryAggregations>>
} {
  return useMemo(() => {
    if (!groups) return {}
    const keyed = groups.map((g) => ({ ...g, key: groupPathKey(g.path ?? [g.name]) }))
    const withAggregations = keyed.flatMap((g) =>
      g.aggregations ? [[g.key, g.aggregations] as const] : []
    )
    return {
      groupCounts: Object.fromEntries(keyed.map((g) => [g.key, g.count])),
      ...(withAggregations.length > 0
        ? { groupAggregations: Object.fromEntries(withAggregations) }
        : {}),
    }
  }, [groups])
}

export function useDataTableQuery(params: UseDataTableQueryParams) {
  const {
    table,
    system,
    systemQuery,
    sourceId,
    sharedFilterParams,
    pagination,
    sorting,
    globalFilter,
    aggregateParam,
    groupByParam,
    dataSourceFilter,
    dataSourceSort,
    refreshMode,
    pollIntervalMs,
  } = params

  // User-applied sort takes precedence; fall back to schema-defined default sort.
  const userSortParam =
    sorting.length > 0
      ? sorting.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',')
      : undefined
  const defaultSortParam = buildDataSourceSortParam(dataSourceSort)
  const sortParam = userSortParam ?? defaultSortParam

  const filterParam = buildFilterParam(dataSourceFilter)

  const resolved: ResolvedQuery = {
    table,
    system,
    systemQuery,
    sourceId,
    sharedFilterParams,
    pagination,
    sortParam,
    globalFilter,
    filterParam,
    aggregateParam,
    groupByParam,
  }
  const queryKey = buildQueryKey(resolved, sortParam)
  const refetchInterval = resolveRefetchInterval(refreshMode, pollIntervalMs)

  const result = useQuery({
    queryKey,
    refetchInterval,
    queryFn: (): Promise<DataTableFetchResult> => runDataTableFetch(resolved),
  })

  return { ...result, queryKey, ...useGroupStats(result.data?.groups) }
}
