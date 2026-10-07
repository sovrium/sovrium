/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { createRecordsClient, createViewRecordsClient } from '@/presentation/api/client'
import { useLazySharedFilter } from '../hooks/use-lazy-shared-filter'
import { useLiveRefresh, type LiveRefreshSource } from '../hooks/use-realtime-subscription'
import type { SharedFilterBindingConfig } from '../hooks/use-shared-filter'
import type { TableRecord } from '../runtime/types'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'

const apiClient = createRecordsClient(typeof window !== 'undefined' ? window.location.origin : '')
const viewsClient = createViewRecordsClient(
  typeof window !== 'undefined' ? window.location.origin : ''
)

const DOMAIN_TO_API_OPERATOR: Record<string, string> = {
  eq: 'equals',
  neq: 'notEquals',
  gt: 'greaterThan',
  lt: 'lessThan',
  gte: 'greaterThanOrEqual',
  lte: 'lessThanOrEqual',
  contains: 'contains',
}

export function buildFilterParam(filters: readonly DataFilter[] | undefined): string | undefined {
  if (!filters || filters.length === 0) return undefined
  const conditions = filters.map((f) => ({
    field: f.field,
    operator: DOMAIN_TO_API_OPERATOR[f.operator] ?? f.operator,
    value: f.value,
  }))
  return JSON.stringify({ and: conditions })
}

function buildSortParam(sort: readonly DataSort[] | undefined): string | undefined {
  if (!sort || sort.length === 0) return undefined
  return sort.map((s) => `${s.field}:${s.direction}`).join(',')
}

/** One page of records — through the bound view's route when there is one, so the view's filter applies. */
const requestRecords = (
  table: string,
  view: string | undefined,
  query: Readonly<Record<string, string>>
) =>
  view === undefined
    ? apiClient.api.tables[':tableId'].records.$get({ param: { tableId: table }, query })
    : viewsClient.api.tables[':tableId'].views[':viewId'].records.$get({
        param: { tableId: table, viewId: view },
        query,
      })

export interface ChartRecordsDataSource extends SharedFilterBindingConfig, LiveRefreshSource {
  readonly table: string
  readonly view?: string
  readonly filter?: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
}

export interface ChartFetchResult {
  readonly records: readonly TableRecord[]
}

/**
 * Fetches records for the chart component in a single page (limit 100).
 *
 * Mirrors `useGalleryRecords` — the basic chart spec works within the
 * default records-API page envelope; aggregation layers on top.
 */
export function useChartRecords(dataSource: ChartRecordsDataSource | undefined) {
  // A binding on a filter bar narrows the read to what the bar holds.
  const shared = useLazySharedFilter(
    { bindTo: dataSource?.bindTo, sharedFilter: dataSource?.sharedFilter },
    buildFilterParam(dataSource?.filter)
  )
  const { filterParam, extraParams } = shared
  const sortParam = buildSortParam(dataSource?.sort)

  const queryKey = [
    'chart-records',
    dataSource?.table,
    dataSource?.view,
    filterParam,
    sortParam,
    extraParams,
  ]

  const read = useQuery({
    queryKey,
    enabled: Boolean(dataSource?.table) && shared.ready,
    queryFn: async (): Promise<ChartFetchResult> => {
      if (!dataSource?.table) return { records: [] }

      const query = {
        ...extraParams,
        page: '1',
        limit: '100',
        ...(sortParam && { sort: sortParam }),
        ...(filterParam && { filter: filterParam }),
      }

      const res = await requestRecords(dataSource.table, dataSource.view, query)

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Failed to fetch records: ${String(res.status)} ${body}`)
      }

      const json = (await res.json()) as {
        records?: readonly (TableRecord & { fields?: TableRecord })[]
      }

      const rawRecords = json.records ?? []
      const flatRecords: readonly TableRecord[] = rawRecords.map((r) => {
        const { fields, ...rest } = r
        return { ...rest, ...(fields ?? {}) }
      })

      return { records: flatRecords }
    },
  })
  // A `dataSource.refreshMode` reads the page of records again (a view-bound chart stays static).
  useLiveRefresh(dataSource, read.refetch)
  return read
}
