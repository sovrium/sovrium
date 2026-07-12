/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { buildSystemQueryUrl } from '../shared/system-query-url'
import type { ChartFetchResult } from './use-chart-records'
import type { TableRecord } from '../shared/types'
import type { ChartSystemSource } from '@/domain/models/app/pages/components/component-types/data/chart'


export function useChartSystemRecords(system: ChartSystemSource | undefined) {
  return useQuery({
    queryKey: ['chart-system-records', system?.endpoint, system?.rowsKey, system?.query],
    enabled: Boolean(system?.endpoint),
    queryFn: async (): Promise<ChartFetchResult> => {
      if (!system?.endpoint) return { records: [] }

      const res = await fetch(buildSystemQueryUrl(system), { credentials: 'include' })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Failed to fetch chart system rows: ${String(res.status)} ${body}`)
      }

      const json = (await res.json()) as Record<string, unknown>
      const rowsKey = system.rowsKey ?? 'items'
      const records = Array.isArray(json[rowsKey]) ? (json[rowsKey] as readonly TableRecord[]) : []
      return { records }
    },
  })
}
