/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { resolveRefetchInterval } from '../hooks/use-realtime-subscription'
import { retryUnlessRateLimited } from '../runtime/read-failure'
import { buildFilterParam, buildDataSourceSortParam, runDataTableFetch } from './data-table-fetch'
import { groupPathKey } from './group-order'
import type { DataTableFetchResult, GroupCount, ResolvedQuery } from './data-table-fetch'
import type { ServerFilterGroup } from './island/island-setup-helpers'
import type { SummaryAggregations } from './summary-aggregate'
import type {
  DataTableSummaryItem,
  DataTableSystemSource,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SortingState, PaginationState } from '@tanstack/react-table'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseDataTableQueryParams {
  readonly table: string
  /**
   * One of the table's declared views (`dataSource.view`, id or name). When
   * set, the page is read through `GET /api/tables/:t/views/:v/records`, which
   * applies the view's filters, sorts and fields on the server.
   */
  readonly view?: string
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
  /**
   * Relationship labels the columns name (`?labels=field:relatedField,…`), so
   * a column showing a related record's name reads it from `_display` even when
   * the table declares no `displayField`. Absent when no column names one.
   */
  readonly labelsParam?: string
  /**
   * The grid loads page by page (`pagination.style: loadMore`): each response
   * says whether a further page exists, as the `nextCursor` a cursor feed
   * carries, so the one "Load more" control serves both kinds of feed.
   */
  readonly loadMore?: boolean
  /**
   * The filter-builder's rows, sent with the request rather than applied to
   * the loaded page — set only for a load-more grid (see `toServerFilterGroup`).
   */
  readonly runtimeFilter?: ServerFilterGroup
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

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
        // The WHOLE binding, not its endpoint + query: `rowsKey`, `idKey` and
        // `totalKey` each change the normalised answer, and every island on a
        // page reads one shared cache, so two grids on one endpoint that pick a
        // different array out of it must not share an entry.
        q.system,
        q.sourceId,
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
        q.view,
        q.pagination,
        sortParam,
        q.globalFilter,
        q.filterParam,
        q.aggregateParam,
        q.groupByParam,
        q.labelsParam,
        // A load-more grid's answer carries a `nextCursor` a numbered grid's
        // does not, and the page's islands share one cache.
        q.loadMore,
        q.sharedFilterParams,
      ]
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

/**
 * Resolve the hook's parameters into the one request description every fetch
 * branch, and the query key, read from.
 *
 * The user's sort wins over the schema's default sort, which is the fallback
 * only when no header or overlay sort is applied.
 */
function resolveQuery(params: UseDataTableQueryParams): ResolvedQuery {
  const { sorting, dataSourceSort, cursor } = params
  const userSortParam =
    sorting.length > 0
      ? sorting.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',')
      : undefined
  return {
    table: params.table,
    ...(params.view !== undefined && { view: params.view }),
    system: params.system,
    systemQuery: params.systemQuery,
    sourceId: params.sourceId,
    sharedFilterParams: params.sharedFilterParams,
    ...(cursor !== undefined && { cursor }),
    pagination: params.pagination,
    sortParam: userSortParam ?? buildDataSourceSortParam(dataSourceSort),
    globalFilter: params.globalFilter,
    filterParam: buildFilterParam(params.dataSourceFilter, params.runtimeFilter),
    aggregateParam: params.aggregateParam,
    summary: params.summary,
    groupByParam: params.groupByParam,
    labelsParam: params.labelsParam,
    loadMore: params.loadMore,
  }
}

export function useDataTableQuery(params: UseDataTableQueryParams) {
  const { refreshMode, pollIntervalMs } = params
  const resolved = resolveQuery(params)
  const { sortParam } = resolved
  const queryKey = buildQueryKey(resolved, sortParam)
  // The grid keeps polling on the realtime fallback even while its feed is
  // connected: that is what reconciles a write the change feed never sees.
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
    retry: retryUnlessRateLimited,
    queryFn: (): Promise<DataTableFetchResult> => runDataTableFetch(resolved),
  })

  return { ...result, queryKey, ...useGroupStats(result.data?.groups) }
}
