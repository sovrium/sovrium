/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { createRecordsClient } from '@/presentation/api/client'
import type { TableRecord } from '../shared/types'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SortingState, PaginationState } from '@tanstack/react-table'


export interface FetchResult {
  readonly records: readonly TableRecord[]
  readonly total: number
}

interface UseDataTableQueryParams {
  readonly table: string
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
}

async function fetchTableRecords({
  table,
  pagination,
  sortParam,
  globalFilter,
  filterParam,
}: FetchQuery): Promise<FetchResult> {
  const query = {
    page: String(pagination.pageIndex + 1),
    ...(pagination.pageSize && { limit: String(pagination.pageSize) }),
    ...(sortParam && { sort: sortParam }),
    ...(globalFilter && { q: globalFilter }),
    ...(filterParam && { filter: filterParam }),
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


export function useDataTableQuery(params: UseDataTableQueryParams) {
  const {
    table,
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

  const queryKey = ['table-records', table, pagination, sortParam, globalFilter, filterParam]

  const refetchInterval =
    refreshMode === 'poll'
      ? (pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
      : refreshMode === 'realtime'
        ? REALTIME_FALLBACK_POLL_MS
        : false

  const result = useQuery({
    queryKey,
    refetchInterval,
    queryFn: (): Promise<FetchResult> =>
      fetchTableRecords({ table, pagination, sortParam, globalFilter, filterParam }),
  })

  return { ...result, queryKey }
}
