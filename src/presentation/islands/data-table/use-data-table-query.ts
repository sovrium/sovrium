/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createRecordsClient } from '@/presentation/api/client'
import {
  buildSystemQueryString,
  fetchSystemEndpoint,
  readAppliedQuery,
} from '../hooks/use-system-source-fetch'
import { groupPathKey } from './group-order'
import { computeRowAggregations } from './summary-aggregate'
import type { SummaryAggregations } from './summary-aggregate'
import type { FetchResult, SystemFetchQuery } from '../hooks/use-system-source-fetch'
import type { TableRecord } from '../runtime/types'
import type {
  DataTableSummaryItem,
  DataTableSystemSource,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'
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
 * source has no aggregate parameter to send, so its block is reduced from the
 * rows that came back instead — same shape, narrower claim.
 *
 * Exported because it reaches the INFERRED return type of `useRecordsQuery`
 * through this hook's own return, and a `.d.ts` cannot reference a name its
 * declaring module keeps to itself. Keep the `export` even though every value
 * that reads it lives in this file: without it the declaration emit of the
 * release build fails (TS4058), while `bun run typecheck` stays green.
 */
export interface DataTableFetchResult extends FetchResult {
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
  /**
   * Continuation token for a cursor-paginated system endpoint
   *. Set only after the
   * operator asks for more, and only from a token the previous response
   * actually carried. Part of the query key, so each page is its own cache
   * entry; the pages already shown are remembered by `useSystemCursorPages`.
   * Inert for the DB-table path, which pages by number.
   */
  readonly cursor?: string
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
   * The grid's declared `summary`, carried for the SYSTEM-SOURCE path only.
   *
   * A read endpoint takes no `?aggregate=` parameter, so the block the DB-table
   * path reads out of the response does not exist there and the footer used to
   * render an em-dash under every label. The declaration therefore travels and
   * the rows are reduced on arrival — see `computeRowAggregations`. The DB-table
   * path ignores this: `aggregateParam` already carries the same declaration in
   * the form its server understands.
   */
  readonly summary?: readonly DataTableSummaryItem[]
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
    appliedQuery?: string | null
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
    // The records route's own declaration that it already applied `?q=`, read by
    // KEY PRESENCE (`readAppliedQuery`) — the ONLY thing that switches off
    // TanStack's second, page-local narrowing (`use-island-setup.ts:447` →
    // `use-table.ts:130`). Without it every DB-table grid filtered a page the
    // server had already filtered, over the RENDERED columns only, so a row
    // matched on a field the grid does not show as a column was discarded on
    // arrival. The trash branch omits the key and therefore keeps filtering
    // here, which is correct: it never searched.
    ...readAppliedQuery(json),
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
  readonly cursor?: string
  readonly pagination: PaginationState
  readonly sortParam?: string
  readonly globalFilter: string
  readonly filterParam?: string
  readonly aggregateParam?: string
  readonly summary?: readonly DataTableSummaryItem[]
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
        // A continuation is a DIFFERENT page of the same feed, so it must not
        // resolve from the previous page's entry. Keying on it is also what
        // gives `keepPreviousData` something to keep while the next page loads.
        q.cursor,
        // The cached entry now carries a REDUCTION of the rows as well as the
        // rows, so two grids on one endpoint declaring different summaries are
        // asking different questions and must not share an answer.
        q.summary,
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

/**
 * The whole-view aggregates a system-bound grid's summary footer describes.
 *
 * ## It describes the view, like every other summary
 *
 * A summary answers a question about the GRID, not about the page that happens
 * to be open — which is why the DB-table path computes it in SQL over the whole
 * filtered table, and why `[internal ref]` pins it as invariant
 * under paging. A read endpoint takes no `?aggregate=`, so its rows have to be
 * reduced in the browser; reducing the PAGE would have reinstated that exact
 * defect on this binding, with the total moving on every page turn.
 *
 * So the reduction runs over the rows the endpoint serves for this binding with
 * the page window removed — same endpoint, same static and dynamic params, same
 * sort and the same search term, so the figure follows the rows rather than
 * describing a different set, and no `page`, `limit` or `cursor`. The chart
 * island's system binding already reads its series this way
 * (`use-chart-system-records.ts`): an aggregate-shaped consumer asks for the
 * set, not for a page of it.
 *
 * ## The grid can only remove ITS OWN window
 *
 * The window that can be dropped is the one the GRID adds — the `page` and
 * `limit` it derives from its pagination state. Two others cannot be, and both
 * leave the reduction with the rows in hand:
 *
 *  - a `limit` the BINDING declares (`system.query.limit`, or a dynamic param)
 *    is the author naming this endpoint's page size, and it survives into every
 *    request by design. Re-asking would return the same page of it.
 *  - a CURSOR names a position in a feed that can only be walked. Dropping it
 *    asks for the first page rather than for the feed, so the figure would
 *    describe page one while the reader looks at page four.
 *
 * ## And it only asks when that is a different question
 *
 * Whether the grid narrowed anything is read off the REQUEST, by comparing the
 * two query strings, and NOT off the response's `total`. `total` cannot answer
 * it: an envelope declaring no `totalKey` has its total set to the page length
 * by `parseSystemEnvelope`, so a 25-row window onto 30 rows and a complete
 * 25-row feed are the same two numbers.
 *
 * An endpoint whose own page size is smaller than its collection answers the
 * unwindowed request with one page anyway, and the figure then covers what it
 * served — stated rather than hidden.
 */
async function readSystemAggregations(
  page: FetchResult,
  request: SystemFetchQuery,
  q: ResolvedQuery
): Promise<SummaryAggregations | undefined> {
  const { summary } = q
  if (!summary || summary.length === 0) return undefined
  const unwindowed: SystemFetchQuery = { ...request, pagination: { pageIndex: 0 } }
  const unwindowedQuery = buildSystemQueryString(unwindowed)
  const windowBelongsToTheBinding =
    q.cursor !== undefined || new URLSearchParams(unwindowedQuery).has('limit')
  if (windowBelongsToTheBinding || unwindowedQuery === buildSystemQueryString(request)) {
    return computeRowAggregations(page.records, summary)
  }
  // A refused aggregate read must not take the rows down with it. The page is
  // already fetched and correct, so a failure here falls back to the narrower
  // figure that page supports rather than failing the grid over its footer.
  const whole = await fetchSystemEndpoint(unwindowed).catch(() => page)
  return computeRowAggregations(whole.records, summary)
}

/**
 * Fetch one page from a system read endpoint, plus the figure its footer
 * describes — see {@link readSystemAggregations} for the scope that figure has.
 *
 * The cursor is spread onto the PAGE request only: it names a position, and the
 * aggregate request is the one that deliberately has none.
 */
async function runSystemFetch(
  q: ResolvedQuery,
  system: DataTableSystemSource
): Promise<DataTableFetchResult> {
  const request: SystemFetchQuery = {
    system,
    systemQuery: q.systemQuery,
    sourceId: q.sourceId,
    pagination: q.pagination,
    sortParam: q.sortParam,
    globalFilter: q.globalFilter,
  }
  const page = await fetchSystemEndpoint({
    ...request,
    ...(q.cursor !== undefined && { cursor: q.cursor }),
  })
  const aggregations = await readSystemAggregations(page, request, q)
  return aggregations === undefined ? page : { ...page, aggregations }
}

/**
 * Dispatch one fetch to the system endpoint OR the DB-table records API.
 *
 * Both branches answer with the aggregations block in the same shape — one from
 * SQL, one reduced in the browser — so the footer downstream reads one shape and
 * neither binding needs a special case of its own.
 */
function runDataTableFetch(q: ResolvedQuery): Promise<DataTableFetchResult> {
  return q.system
    ? runSystemFetch(q, q.system)
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
    cursor,
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
    ...(cursor !== undefined && { cursor }),
    pagination,
    sortParam,
    globalFilter,
    filterParam,
    aggregateParam,
    summary: params.summary,
    groupByParam,
  }
  const queryKey = buildQueryKey(resolved, sortParam)
  const refetchInterval = resolveRefetchInterval(refreshMode, pollIntervalMs)

  const result = useQuery({
    queryKey,
    refetchInterval,
    // Sorting, paging and searching all re-key this query, and a new key has no
    // cached entry — so without this the rows the operator was reading are
    // dropped the instant they click, and replaced by skeletons, before the
    // server has said anything at all. Keeping the previous page in place means
    // an interaction only ever ADDS the new answer; it never first takes away
    // the old one. It also makes a refusal survivable: the last good page is
    // still on screen when the failure lands, which is what lets the grid keep
    // showing data instead of an error in place of itself.
    placeholderData: keepPreviousData,
    queryFn: (): Promise<DataTableFetchResult> => runDataTableFetch(resolved),
  })

  return { ...result, queryKey, ...useGroupStats(result.data?.groups) }
}
