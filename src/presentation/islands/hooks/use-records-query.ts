/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createRecordsClient } from '@/presentation/api/client'
import { fetchSystemEndpoint, fetchSystemDetailEndpoint } from './use-system-source-fetch'
import type { FetchResult } from './use-system-source-fetch'
import type { TableRecord } from '../shared/types'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'


export type { FetchResult }


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

export function buildFilterParam(filters: readonly DataFilter[] | undefined): string | undefined {
  if (!filters || filters.length === 0) return undefined
  const conditions = filters.map((f) => ({
    field: f.field,
    operator: DOMAIN_TO_API_OPERATOR[f.operator] ?? f.operator,
    value: f.value,
  }))
  return JSON.stringify({ and: conditions })
}

export function buildSortParam(sort: readonly DataSort[] | undefined): string | undefined {
  if (!sort || sort.length === 0) return undefined
  return sort.map((s) => `${s.field}:${s.direction}`).join(',')
}


export interface RecordsDataSource {
  readonly table?: string
  readonly system?: SystemSource
  readonly view?: string
  readonly filter?: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
}

export const RECORDS_PAGE_SIZE = 100


async function fetchTableRecords(
  table: string,
  sortParam: string | undefined,
  filterParam: string | undefined
): Promise<FetchResult> {
  const query = {
    page: '1',
    limit: String(RECORDS_PAGE_SIZE),
    ...(sortParam && { sort: sortParam }),
    ...(filterParam && { filter: filterParam }),
  }

  const res = await apiClient.api.tables[':tableId'].records.$get({
    param: { tableId: table },
    query,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to fetch records: ${String(res.status)} ${body}`)
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


export function useRecordsQuery(
  keyPrefix: string,
  dataSource: RecordsDataSource | undefined
): UseQueryResult<FetchResult> {
  const system = dataSource?.system
  const table = dataSource?.table
  const filterParam = buildFilterParam(dataSource?.filter)
  const sortParam = buildSortParam(dataSource?.sort)

  const queryKey = system
    ? [`${keyPrefix}-system-rows`, system.endpoint, system.query, sortParam]
    : [`${keyPrefix}-records`, table, filterParam, sortParam]

  return useQuery({
    queryKey,
    enabled: Boolean(system) || Boolean(table),
    queryFn: (): Promise<FetchResult> => {
      if (system) {
        return fetchSystemEndpoint({
          system,
          pagination: { pageIndex: 0, pageSize: RECORDS_PAGE_SIZE },
          sortParam,
        })
      }
      if (!table) return Promise.resolve({ records: [], total: 0 })
      return fetchTableRecords(table, sortParam, filterParam)
    },
  })
}


export interface RecordDataSource {
  readonly table?: string
  readonly mode?: string
  readonly param?: string
  readonly system?: SystemDetailSource
}

export function useRecordQuery(
  keyPrefix: string,
  dataSource: RecordDataSource | undefined,
  id: string | undefined
): UseQueryResult<TableRecord | undefined> {
  const system = dataSource?.system
  return useQuery({
    queryKey: [`${keyPrefix}-system-detail`, system?.endpoint, id, system?.query],
    enabled: Boolean(system) && Boolean(id),
    queryFn: (): Promise<TableRecord | undefined> =>
      system && id ? fetchSystemDetailEndpoint(system, id) : Promise.resolve(undefined),
  })
}
