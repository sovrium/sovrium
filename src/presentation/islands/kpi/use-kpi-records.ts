/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { createRecordsClient } from '@/presentation/api/client'
import type { TableRecord } from '../shared/types'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'

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

export interface KpiRecordsDataSource {
  readonly table: string
  readonly view?: string
  readonly filter?: readonly DataFilter[]
}

export interface KpiFetchResult {
  readonly records: readonly TableRecord[]
}

export function useKpiRecords(dataSource: KpiRecordsDataSource | undefined) {
  const filterParam = buildFilterParam(dataSource?.filter)

  const queryKey = ['kpi-records', dataSource?.table, filterParam]

  return useQuery({
    queryKey,
    enabled: Boolean(dataSource?.table),
    queryFn: async (): Promise<KpiFetchResult> => {
      if (!dataSource?.table) return { records: [] }

      const query = {
        page: '1',
        limit: '100',
        ...(filterParam && { filter: filterParam }),
      }

      const res = await apiClient.api.tables[':tableId'].records.$get({
        param: { tableId: dataSource.table },
        query,
      })

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
}
