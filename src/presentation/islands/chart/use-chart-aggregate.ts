/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { createRecordsClient } from '@/presentation/api/client'
import { useLazySharedFilter } from '../hooks/use-lazy-shared-filter'
import { useLiveRefresh } from '../hooks/use-realtime-subscription'
import { buildFilterParam, type ChartRecordsDataSource } from './use-chart-records'
import type { ChartAggregateConfig } from './chart-aggregate'
import type { TableRecord } from '../runtime/types'

const apiClient = createRecordsClient(typeof window !== 'undefined' ? window.location.origin : '')

/** The row field a counted group's figure travels in — never a table field. */
const COUNT_FIELD = '__count'

interface AggregateGroup {
  readonly name: string | null
  readonly count: number
  readonly aggregations?: Readonly<Record<string, unknown>>
}

/** The aggregate read's `aggregate` parameter for a chart; none for a count. */
const aggregateParam = (config: ChartAggregateConfig): string | undefined =>
  config.function === 'count' || config.field === undefined
    ? undefined
    : `${config.field}:${config.function}`

/**
 * The chart's own aggregate, restated over one row per group: a sum, an
 * average, a minimum, a maximum or a percentile of one value is that value, so the canvas
 * reduces the rows to the figures the database computed; a count becomes the
 * sum of each group's count.
 */
export const chartAggregateOverGroups = (config: ChartAggregateConfig): ChartAggregateConfig =>
  config.function === 'count' ? { ...config, function: 'sum', field: COUNT_FIELD } : config

/** One row per group, carrying the group's name under the grouping field and its figure. */
const groupRows = (
  groups: readonly AggregateGroup[],
  config: ChartAggregateConfig
): readonly TableRecord[] =>
  groups
    // An empty value groups as `''`; a chart draws no category for a record without one.
    .filter((group) => group.name !== null && group.name !== '')
    .flatMap((group) => {
      const figure =
        config.function === 'count' ? group.count : group.aggregations?.[config.function]
      // A figure over no values (a percentile, an average) is `null`: nothing to draw, never a 0.
      const value = figure === null ? Number.NaN : Number(figure)
      if (!Number.isFinite(value)) return []
      const field = config.function === 'count' ? COUNT_FIELD : (config.field ?? COUNT_FIELD)
      return [{ [config.groupBy]: group.name, [field]: value } as TableRecord]
    })

/** The aggregate read's query string for a chart's question. */
const aggregateQuery = (
  config: ChartAggregateConfig,
  filterParam: string | undefined,
  extraParams: Readonly<Record<string, string>>
): Readonly<Record<string, string>> => {
  const figure = aggregateParam(config)
  return {
    ...extraParams,
    ...(filterParam === undefined ? {} : { filter: filterParam }),
    ...(figure === undefined ? {} : { aggregate: figure }),
    groupBy: config.groupBy,
    ...(config.interval === undefined ? {} : { interval: config.interval }),
  }
}

/** Ask the aggregate read; a refusal is thrown with its status, as TanStack Query expects. */
const fetchGroups = async (
  table: string,
  query: Readonly<Record<string, string>>
): Promise<readonly AggregateGroup[]> => {
  const res = await apiClient.api.tables[':tableId'].aggregate.$get({
    param: { tableId: table },
    query,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to aggregate records: ${String(res.status)} ${body}`, {
      cause: { status: res.status },
    })
  }
  const json = (await res.json()) as { readonly groups?: readonly AggregateGroup[] }
  return json.groups ?? []
}

/**
 * A chart's groups from ONE aggregate read (`GET /api/tables/:t/aggregate`)
 * over every matching record, instead of the first page of records grouped in
 * the browser — one request per distinct question, shared by every widget
 * asking it. Pass no data source to leave it idle.
 */
export function useChartAggregate(
  dataSource: ChartRecordsDataSource | undefined,
  config: ChartAggregateConfig | undefined
) {
  const shared = useLazySharedFilter(
    { bindTo: dataSource?.bindTo, sharedFilter: dataSource?.sharedFilter },
    buildFilterParam(dataSource?.filter)
  )
  const { filterParam, extraParams } = shared
  const query = config === undefined ? undefined : aggregateQuery(config, filterParam, extraParams)
  const table = dataSource?.table

  const read = useQuery({
    // The key names the question, not the widget: two widgets asking it share one request.
    queryKey: ['table-aggregate', table, query],
    enabled: table !== undefined && query !== undefined && shared.ready,
    queryFn: () =>
      table === undefined || query === undefined ? Promise.resolve([]) : fetchGroups(table, query),
    select: (groups: readonly AggregateGroup[]) => ({
      records: config === undefined ? [] : groupRows(groups, config),
    }),
  })
  // A `dataSource.refreshMode` re-asks the same aggregate read; never rows.
  useLiveRefresh(dataSource, read.refetch)
  return read
}
