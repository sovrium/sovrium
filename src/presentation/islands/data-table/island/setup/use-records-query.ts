/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useSystemCursorPages } from '../../../hooks/use-system-cursor-pages'
import { useRuntimeFilter, type RuntimeFilter } from '../../faceted-filter/runtime-filter'
import { buildSummaryAggregateParam } from '../../summary-aggregate'
import { useDataTableQuery } from '../../use-data-table-query'
import { buildGroupByParam, buildLabelsParam } from '../island-setup-helpers'
import type { SetupContext } from './setup-params'
import type { EffectiveLayout } from './use-effective-layout'
import type { EffectiveQuery } from './use-effective-query'
import type { SystemQueryParams } from './use-system-query-params'
import type { ViewGroupBy } from '@/domain/models/app/tables/views/group-by'
import type { PaginationState } from '@tanstack/react-table'

export type RecordsQuery = ReturnType<typeof useRecordsQuery>

/**
 * How a DB-table grid that loads page by page (`pagination.style: loadMore`)
 * asks for its rows, or `undefined` for every other grid.
 *
 * The pages it has already shown are carried by the same accumulator a cursor
 * feed uses — `useSystemCursorPages` — with the next PAGE NUMBER standing in for
 * the cursor. Its feed key names everything that decides which rows are listed
 * and in what order, so a change of sort, filter, search, grouping or page size starts
 * again from the first page rather than appending a different list's rows under
 * the old one.
 *
 * The reader's narrowing (`RuntimeFilter`) is part of that key.
 */
function resolveLoadMoreFeed(
  ctx: SetupContext,
  layout: EffectiveLayout,
  effective: EffectiveQuery,
  feed: { readonly system: SystemQueryParams; readonly runtime: RuntimeFilter }
) {
  const { system, runtime } = feed
  const { dataSource, paginationConfig } = ctx.params
  const style = paginationConfig?.style
  // `infinite` appends through the same continuation as `loadMore`; only what
  // asks for the next page differs (the end of the rows scrolling into view).
  if (dataSource.system !== undefined || (style !== 'loadMore' && style !== 'infinite'))
    return undefined
  const { tableState } = layout
  const identity = [
    ctx.tableKey,
    effective.sorting,
    effective.filter,
    runtime.key,
    tableState.globalFilter,
    tableState.pagination.pageSize,
    system.sharedFilterParams,
  ]
  return { identity }
}

/**
 * The feed key names WHAT is being enumerated: change the endpoint, its static
 * or dynamic params, the sort, the term or the page size and the server is
 * walking a different sequence, so the accumulated pages and the token that
 * indexes them stop being answers to the question now being asked. A numbered
 * DB-table grid never enters this path, which its empty feed key expresses; a
 * load-more one brings its own key (`resolveLoadMoreFeed`).
 */
function systemFeedIdentity(
  ctx: SetupContext,
  layout: EffectiveLayout,
  effective: EffectiveQuery,
  system: SystemQueryParams
): unknown {
  const source = ctx.params.dataSource.system
  if (!source) return undefined
  const { tableState } = layout
  return [
    source.endpoint,
    source.query,
    system.systemQuery,
    effective.sorting,
    tableState.globalFilter,
    tableState.pagination.pageSize,
  ]
}

/**
 * The records read itself, plus the request parameters that have to be
 * resolved before it can be issued.
 *
 * The grouping is resolved here rather than at render time because the grouped
 * field is part of the request: a group header's count describes the whole
 * view, which only the server can compute.
 */
export function useRecordsQuery(
  ctx: SetupContext,
  layout: EffectiveLayout,
  effective: EffectiveQuery,
  system: SystemQueryParams
) {
  const { dataSource, summaryConfig, groupByConfig } = ctx.params
  const { tableState } = layout

  // The bound view's grouping, fixed for the life of the grid: no reader
  // control changes it.
  const effectiveGroupByConfig: ViewGroupBy | undefined = groupByConfig

  // A table-bound grid sends the reader's narrowing with every request, so the
  // rows, the pager and the summary all count the narrowed set.
  const runtime = useRuntimeFilter(ctx.ui, Boolean(dataSource.system), tableState.setPagination)
  const loadMoreFeed = resolveLoadMoreFeed(ctx, layout, effective, { system, runtime })

  const cursorPages = useSystemCursorPages(
    loadMoreFeed?.identity ?? systemFeedIdentity(ctx, layout, effective, system)
  )

  // A load-more or infinite feed continues from an OFFSET (its cursor), so the
  // page window is always the first, shifted by that offset.
  const pagination: PaginationState = loadMoreFeed
    ? { pageIndex: 0, pageSize: tableState.pagination.pageSize }
    : tableState.pagination

  const query = useDataTableQuery({
    ...requestParams(ctx, effectiveGroupByConfig, loadMoreFeed),
    ...(runtime.filter && { runtimeFilter: runtime.filter }),
    ...(dataSource.system && {
      system: dataSource.system,
      systemQuery: system.systemQuery,
      sourceId: ctx.params.searchSourceId,
      // A read endpoint takes no `?aggregate=`, so the declaration itself has to
      // travel: the rows that come back are reduced in the browser rather than
      // the footer drawing a placeholder under every label.
      summary: summaryConfig,
      cursor: cursorPages.cursor,
    }),
    // DB-table grids merge the shared-filter publisher's value as raw query params.
    ...(!dataSource.system && { sharedFilterParams: system.sharedFilterParams }),
    ...(loadMoreFeed && { offset: Number(cursorPages.cursor ?? 0) }),
    pagination,
    sorting: effective.sorting,
    globalFilter: tableState.globalFilter,
    dataSourceFilter: effective.filter,
    dataSourceSort: dataSource.sort,
    // A view-bound grid never refreshes on its own: no poll, and no realtime
    // fallback poll either (`use-refresh-wiring.ts`).
    refreshMode: ctx.isViewBound ? undefined : dataSource.refreshMode,
    pollIntervalMs: dataSource.pollIntervalMs,
  })

  return {
    query,
    cursorPages,
    effectiveGroupByConfig,
    loadMore: loadMoreFeed !== undefined,
    // The builder's rows already narrowed the request, so the rows must not be
    // narrowed a second time in the browser.
    filteredOnServer: runtime.builderOnServer,
  }
}

/**
 * The request parameters that follow from the grid's declarations alone: the
 * summary footer's whole-view aggregates, the grouping levels, the labels its
 * columns name, and the load-more feed's own switches.
 */
function requestParams(
  ctx: SetupContext,
  groupBy: ViewGroupBy | undefined,
  loadMoreFeed: ReturnType<typeof resolveLoadMoreFeed>
) {
  const { dataSource, summaryConfig, columnConfig } = ctx.params
  // The summary footer's numbers describe the WHOLE VIEW, so they are computed
  // in SQL over the same filtered table the page is drawn from and ride the
  // records response. Absent when no summary is declared.
  const aggregateParam = buildSummaryAggregateParam(summaryConfig)
  const groupByParam = buildGroupByParam(groupBy)
  const labelsParam = buildLabelsParam(columnConfig)
  return {
    table: ctx.tableKey,
    ...(ctx.isViewBound && dataSource.view !== undefined && { view: dataSource.view }),
    ...(aggregateParam !== undefined && { aggregateParam }),
    ...(groupByParam !== undefined && { groupByParam }),
    ...(labelsParam !== undefined && !dataSource.system && { labelsParam }),
    ...(loadMoreFeed && { loadMore: true }),
  }
}
