/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { createRecordsClient } from '@/presentation/api/client'
import { fetchSystemEndpoint } from './use-system-source-fetch'
import type { FetchResult } from './use-system-source-fetch'
import type { TableRecord } from '../shared/types'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { DataTableSystemSource } from '@/domain/models/app/pages/components/data-table'
import type { SortingState, PaginationState } from '@tanstack/react-table'


export type { FetchResult }

interface UseDataTableQueryParams {
  readonly table: string
  readonly system?: DataTableSystemSource
  readonly systemQuery?: Record<string, string>
  readonly sourceId?: string
  readonly sharedFilterParams?: Record<string, string>
  readonly pagination: PaginationState
  readonly sorting: SortingState
  readonly globalFilter: string
  readonly dataSourceFilter?: readonly DataFilter[]
  readonly dataSourceSort?: readonly DataSort[]
  readonly refreshMode?: 'none' | 'poll' | 'realtime'
  readonly pollIntervalMs?: number
}

const DEFAULT_POLL_INTERVAL_MS = 30_000

const REALTIME_FALLBACK_POLL_MS = 3000


const apiClient = createRecordsClient(typeof window !== 'undefined' ? window.location.origin : '')


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


interface FetchQuery {
  readonly table: string
  readonly pagination: PaginationState
  readonly sortParam?: string
  readonly globalFilter: string
  readonly filterParam?: string
  readonly sharedFilterParams?: Record<string, string>
}

function dropEmptyParams(params: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(params ?? {}).filter(([, value]) => value !== ''))
}

async function fetchTableRecords({
  table,
  pagination,
  sortParam,
  globalFilter,
  filterParam,
  sharedFilterParams,
}: FetchQuery): Promise<FetchResult> {
  const query: Record<string, string> = {
    page: String(pagination.pageIndex + 1),
    ...(pagination.pageSize && { limit: String(pagination.pageSize) }),
    ...(sortParam && { sort: sortParam }),
    ...(globalFilter && { q: globalFilter }),
    ...(filterParam && { filter: filterParam }),
    ...dropEmptyParams(sharedFilterParams),
  }

  const res = await apiClient.api.tables[':tableId'].records.$get({
    param: { tableId: table },
    query,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to fetch records: ${res.status} ${body}`)
  }

  const json = (await res.json()) as {
    records?: readonly (TableRecord & { fields?: TableRecord })[]
    total?: number
    pagination?: { total?: number }
  }
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


function resolveRefetchInterval(
  refreshMode: UseDataTableQueryParams['refreshMode'],
  pollIntervalMs: number | undefined
): number | false {
  if (refreshMode === 'poll') return pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  if (refreshMode === 'realtime') return REALTIME_FALLBACK_POLL_MS
  return false
}

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
}

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
        q.sharedFilterParams,
      ]
}

function runDataTableFetch(q: ResolvedQuery): Promise<FetchResult> {
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
        sharedFilterParams: q.sharedFilterParams,
      })
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
    dataSourceFilter,
    dataSourceSort,
    refreshMode,
    pollIntervalMs,
  } = params

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
  }
  const queryKey = buildQueryKey(resolved, sortParam)
  const refetchInterval = resolveRefetchInterval(refreshMode, pollIntervalMs)

  const result = useQuery({
    queryKey,
    refetchInterval,
    queryFn: (): Promise<FetchResult> => runDataTableFetch(resolved),
  })

  return { ...result, queryKey }
}
