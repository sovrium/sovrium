/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useSystemCursorPages } from '../../../hooks/use-system-cursor-pages'
import { buildSummaryAggregateParam } from '../../summary-aggregate'
import { useDataTableQuery } from '../../use-data-table-query'
import { buildGroupByParam, buildLabelsParam, toServerFilterGroup } from '../island-setup-helpers'
import type { SetupContext } from './setup-params'
import type { EffectiveLayout } from './use-effective-layout'
import type { EffectiveQuery } from './use-effective-query'
import type { SystemQueryParams } from './use-system-query-params'
import type { DataTableGroupBy } from '@/domain/models/app/pages/components/component-types/data/table/schema'
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
 * Its filter-builder rows travel with the request (`runtimeFilter`): filtering
 * the loaded rows in the browser would hide every match on a page not fetched
 * yet. A row the API cannot express leaves them to the browser instead.
 */
function resolveLoadMoreFeed(
  ctx: SetupContext,
  layout: EffectiveLayout,
  effective: EffectiveQuery,
  system: SystemQueryParams
) {
  const { dataSource, paginationConfig } = ctx.params
  if (dataSource.system !== undefined || paginationConfig?.style !== 'loadMore') return undefined
  const { tableState } = layout
  const runtimeFilter = toServerFilterGroup(ctx.ui.activeFilters, ctx.ui.filterConjunction)
  const identity = [
    ctx.tableKey,
    effective.sorting,
    effective.filter,
    runtimeFilter ?? ctx.ui.activeFilters,
    tableState.globalFilter,
    tableState.pagination.pageSize,
    system.sharedFilterParams,
    // A grouped read orders rows by group first, so a change of grouping is a
    // different sequence — appending its pages under the old ones would repeat
    // and skip rows. The toolbar's choice is the only grouping that can change
    // at runtime; the declared one is fixed for the life of the grid.
    ctx.ui.runtimeGroupBy,
  ]
  return { identity, runtimeFilter }
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

  // Runtime selection from the toolbar's Group menu overrides the schema's
  // static `groupBy` block; clearing the runtime selection (set to `null`)
  // restores the schema default.
  const effectiveGroupByConfig: DataTableGroupBy | undefined =
    ctx.ui.runtimeGroupBy !== null ? { field: ctx.ui.runtimeGroupBy } : groupByConfig

  const loadMoreFeed = resolveLoadMoreFeed(ctx, layout, effective, system)

  const cursorPages = useSystemCursorPages(
    loadMoreFeed?.identity ?? systemFeedIdentity(ctx, layout, effective, system)
  )

  const pagination: PaginationState = loadMoreFeed
    ? { pageIndex: Number(cursorPages.cursor ?? 0), pageSize: tableState.pagination.pageSize }
    : tableState.pagination

  const query = useDataTableQuery({
    ...requestParams(ctx, effectiveGroupByConfig, loadMoreFeed),
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
    filteredOnServer: loadMoreFeed?.runtimeFilter !== undefined,
  }
}

/**
 * The request parameters that follow from the grid's declarations alone: the
 * summary footer's whole-view aggregates, the grouping levels, the labels its
 * columns name, and the load-more feed's own switches.
 */
function requestParams(
  ctx: SetupContext,
  groupBy: DataTableGroupBy | undefined,
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
    ...(loadMoreFeed?.runtimeFilter && { runtimeFilter: loadMoreFeed.runtimeFilter }),
  }
}
