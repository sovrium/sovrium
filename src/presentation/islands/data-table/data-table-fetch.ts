/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createRecordsClient, createViewRecordsClient } from '@/presentation/api/client'
import {
  buildSystemQueryString,
  fetchSystemEndpoint,
  readAppliedQuery,
} from '../hooks/use-system-source-fetch'
import { withSharedFilter } from '../runtime/shared-filter-param'
import { computeRowAggregations } from './summary-aggregate'
import type { ServerFilterGroup } from './island/island-setup-helpers'
import type { SummaryAggregations } from './summary-aggregate'
import type { FetchResult, SystemFetchQuery } from '../hooks/use-system-source-fetch'
import type { TableRecord } from '../runtime/types'
import type {
  DataTableSummaryItem,
  DataTableSystemSource,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { PaginationState } from '@tanstack/react-table'

/**
 * The data-table's record fetch: the records API clients, the filter and
 * sort parameters a grid sends, one page read from a table, a view or a
 * system endpoint, and the whole-view aggregates the summary footer draws.
 */

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

// ---------------------------------------------------------------------------
// API client (singleton, created once per browser context)
// ---------------------------------------------------------------------------

const apiOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const apiClient = createRecordsClient(apiOrigin)
const viewsClient = createViewRecordsClient(apiOrigin)

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
  isEmpty: 'isEmpty',
  isNotEmpty: 'isNotEmpty',
}

export function buildFilterParam(
  filters: readonly DataFilter[] | undefined,
  runtimeFilter?: ServerFilterGroup
): string | undefined {
  const conditions = (filters ?? []).map((f) => ({
    field: f.field,
    operator: DOMAIN_TO_API_OPERATOR[f.operator] ?? f.operator,
    ...(f.value !== undefined && { value: f.value }),
  }))
  const nodes = runtimeFilter === undefined ? conditions : [...conditions, runtimeFilter]
  return nodes.length === 0 ? undefined : JSON.stringify({ and: nodes })
}

export function buildDataSourceSortParam(
  sort: readonly DataSort[] | undefined
): string | undefined {
  if (!sort || sort.length === 0) return undefined
  return sort.map((s) => `${s.field}:${s.direction}`).join(',')
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

interface FetchQuery {
  readonly table: string
  /** Read through this declared view rather than the table's own records route. */
  readonly view?: string
  readonly pagination: PaginationState
  readonly sortParam?: string
  readonly globalFilter: string
  readonly filterParam?: string
  /** Whole-view aggregate request for the summary footer (`?aggregate=` JSON). */
  readonly aggregateParam?: string
  /** Grouped field (`?groupBy=`) — asks for the whole-view per-group counts. */
  readonly groupByParam?: string
  /** Relationship labels the columns name (`?labels=`). */
  readonly labelsParam?: string
  /** Report whether a further page exists, as a `nextCursor` (load-more grids). */
  readonly loadMore?: boolean
  /** Raw cross-component shared-filter params appended to the records URL. */
  readonly sharedFilterParams?: Record<string, string>
}

/** Build the records-API query string for one page fetch. */
function buildRecordsQuery(q: FetchQuery): Record<string, string> {
  // A published `filter` NARROWS the grid's own (author + reader) filter —
  // combined with `and`, as every other subscriber does — and never replaces
  // it. The other published params ride along as raw query params (e.g. a
  // sibling publisher's value forwarded as `?status=`); the records query
  // schema strips unknown keys, so they are inert server-side but observable
  // on the request. They come FIRST so none can displace a key the grid sets.
  const shared = withSharedFilter(q.filterParam, q.sharedFilterParams ?? {})
  return {
    ...shared.extraParams,
    page: String(q.pagination.pageIndex + 1),
    ...(q.pagination.pageSize && { limit: String(q.pagination.pageSize) }),
    ...(q.sortParam && { sort: q.sortParam }),
    ...(q.globalFilter && { q: q.globalFilter }),
    ...(shared.filterParam && { filter: shared.filterParam }),
    // Whole-view aggregates for the summary footer, computed in SQL over the
    // same filtered table the page is drawn from — so the footer describes the
    // view and stays put when the reader turns a page.
    ...(q.aggregateParam && { aggregate: q.aggregateParam }),
    // Whole-view per-group counts for the group headers, over the same filtered
    // table — so a header's count describes the view, not the loaded page.
    ...(q.groupByParam && { groupBy: q.groupByParam }),
    // Labels a column names for its relationship field, resolved server-side
    // under the reader's permissions and returned under `_display`.
    ...(q.labelsParam && { labels: q.labelsParam }),
  }
}

/**
 * The next page a load-more grid may ask for, or `undefined` once every row is
 * loaded. Spelled as the cursor a cursor feed carries, so the grid's one
 * continuation control reads both feeds the same way. A numbered grid gets none.
 */
function nextPageCursor(q: FetchQuery, pageLength: number, total: number): string | undefined {
  if (q.loadMore !== true || pageLength === 0) return undefined
  const { pageIndex, pageSize } = q.pagination
  return pageIndex * pageSize + pageLength < total ? String(pageIndex + 1) : undefined
}

/**
 * One page from the table's records route — or, for a view-bound grid, from
 * the view's records route, which takes the same query and answers the same
 * envelope.
 */
function requestRecordsPage(fetchQuery: FetchQuery) {
  const query = buildRecordsQuery(fetchQuery)
  return fetchQuery.view === undefined
    ? apiClient.api.tables[':tableId'].records.$get({
        param: { tableId: fetchQuery.table },
        query,
      })
    : viewsClient.api.tables[':tableId'].views[':viewId'].records.$get({
        param: { tableId: fetchQuery.table, viewId: fetchQuery.view },
        query,
      })
}

/** Fetch one page of table records from the records API and flatten them. */
async function fetchTableRecords(fetchQuery: FetchQuery): Promise<DataTableFetchResult> {
  const res = await requestRecordsPage(fetchQuery)

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to fetch records: ${res.status} ${body}`, {
      cause: { status: res.status },
    })
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
  const total = json.total ?? json.pagination?.total ?? rawRecords.length
  const nextCursor = nextPageCursor(fetchQuery, rawRecords.length, total)
  return {
    records: flatRecords,
    total,
    ...(nextCursor !== undefined && { nextCursor }),
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

/** The resolved read params for one data-table fetch (system source OR DB table). */
export interface ResolvedQuery {
  readonly table: string
  readonly view?: string
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
  readonly labelsParam?: string
  readonly loadMore?: boolean
}

/**
 * The whole-view aggregates a system-bound grid's summary footer describes.
 *
 * ## It describes the view, like every other summary
 *
 * A summary answers a question about the GRID, not about the page that happens
 * to be open — which is why the DB-table path computes it in SQL over the whole
 * filtered table, and why it holds invariant under paging. A read endpoint takes no `?aggregate=`, so its rows have to be
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
export function runDataTableFetch(q: ResolvedQuery): Promise<DataTableFetchResult> {
  return q.system
    ? runSystemFetch(q, q.system)
    : fetchTableRecords({
        table: q.table,
        view: q.view,
        pagination: q.pagination,
        sortParam: q.sortParam,
        globalFilter: q.globalFilter,
        filterParam: q.filterParam,
        aggregateParam: q.aggregateParam,
        groupByParam: q.groupByParam,
        labelsParam: q.labelsParam,
        loadMore: q.loadMore,
        sharedFilterParams: q.sharedFilterParams,
      })
}
