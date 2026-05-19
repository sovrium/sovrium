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


export interface FetchResult {
  readonly records: readonly TableRecord[]
  readonly total: number
}

export interface GalleryRecordsDataSource {
  readonly table: string
  readonly view?: string
  readonly filter?: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
}

export function useGalleryRecords(dataSource: GalleryRecordsDataSource | undefined) {
  const filterParam = buildFilterParam(dataSource?.filter)
  const sortParam = buildSortParam(dataSource?.sort)

  const queryKey = ['gallery-records', dataSource?.table, filterParam, sortParam]

  return useQuery({
    queryKey,
    enabled: Boolean(dataSource?.table),
    queryFn: async (): Promise<FetchResult> => {
      if (!dataSource?.table) return { records: [], total: 0 }

      const query = {
        page: '1',
        limit: '100',
        ...(sortParam && { sort: sortParam }),
        ...(filterParam && { filter: filterParam }),
      }

      const res = await apiClient.api.tables[':tableId'].records.$get({
        param: { tableId: dataSource.table },
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
    },
  })
}
