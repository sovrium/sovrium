/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useSystemCursorPages } from '../../../hooks/use-system-cursor-pages'
import { buildSummaryAggregateParam } from '../../summary-aggregate'
import { useDataTableQuery } from '../../use-data-table-query'
import { buildGroupByParam } from '../island-setup-helpers'
import type { SetupContext } from './setup-params'
import type { EffectiveLayout } from './use-effective-layout'
import type { EffectiveQuery } from './use-effective-query'
import type { SystemQueryParams } from './use-system-query-params'
import type { DataTableGroupBy } from '@/domain/models/app/pages/components/component-types/data/table/schema'

export type RecordsQuery = ReturnType<typeof useRecordsQuery>

/**
 * The records read itself, plus the two request parameters that have to be
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
  const { dataSource, searchSourceId, summaryConfig, groupByConfig } = ctx.params
  const { tableState } = layout

  // The summary footer's numbers describe the WHOLE VIEW, so they are computed
  // in SQL over the same filtered table the page is drawn from and ride the
  // records response. Absent when no summary is declared.
  const aggregateParam = buildSummaryAggregateParam(summaryConfig)

  // Runtime selection from the toolbar's Group menu overrides the schema's
  // static `groupBy` block; clearing the runtime selection (set to `null`)
  // restores the schema default.
  const effectiveGroupByConfig: DataTableGroupBy | undefined =
    ctx.ui.runtimeGroupBy !== null ? { field: ctx.ui.runtimeGroupBy } : groupByConfig

  const groupByParam = buildGroupByParam(effectiveGroupByConfig)

  // The feed key names WHAT is being enumerated: change the endpoint, its
  // static or dynamic params, the sort, the term or the page size and the
  // server is walking a different sequence, so the accumulated pages and the
  // token that indexes them stop being answers to the question now being
  // asked. A DB-table grid pages by number and never enters this path, which
  // its empty feed key expresses.
  const cursorPages = useSystemCursorPages(
    dataSource.system && [
      dataSource.system.endpoint,
      dataSource.system.query,
      system.systemQuery,
      effective.sorting,
      tableState.globalFilter,
      tableState.pagination.pageSize,
    ]
  )

  const query = useDataTableQuery({
    table: ctx.tableKey,
    ...(dataSource.system && {
      system: dataSource.system,
      systemQuery: system.systemQuery,
      sourceId: searchSourceId,
      // A read endpoint takes no `?aggregate=`, so the declaration itself has to
      // travel: the rows that come back are reduced in the browser rather than
      // the footer drawing a placeholder under every label.
      summary: summaryConfig,
    }),
    cursor: cursorPages.cursor,
    // DB-table grids merge the shared-filter publisher's value as raw query params.
    ...(!dataSource.system && { sharedFilterParams: system.sharedFilterParams }),
    pagination: tableState.pagination,
    sorting: effective.sorting,
    globalFilter: tableState.globalFilter,
    ...(aggregateParam !== undefined && { aggregateParam }),
    ...(groupByParam !== undefined && { groupByParam }),
    dataSourceFilter: effective.filter,
    dataSourceSort: dataSource.sort,
    refreshMode: dataSource.refreshMode,
    pollIntervalMs: dataSource.pollIntervalMs,
  })

  return { query, cursorPages, effectiveGroupByConfig }
}
