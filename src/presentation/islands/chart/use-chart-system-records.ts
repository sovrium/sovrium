/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import {
  fetchSystemEnvelope,
  SystemEnvelopeReadError,
  systemEnvelopeQueryKey,
  type SystemEnvelopeResult,
} from '../runtime/system-envelope-query'
import type { ChartFetchResult } from './use-chart-records'
import type { TableRecord } from '../runtime/types'
import type { ChartSystemSource } from '@/domain/models/app/pages/components/component-types/data/chart'

/**
 * Client-side system rows/series binding for the chart component
 *.
 *
 * When a chart declares `dataSource.system`, it reads its ROWS from a system
 * read endpoint (any `/api/admin/*`, `/api/analytics/*`, or system read route)
 * instead of `/api/tables/:t/records`:
 *  - the hook fetches `system.endpoint` (merging `system.query` static params);
 *  - reads the rows array at `rowsKey` (default `'items'`);
 *  - normalizes `{ [rowsKey]: [...rows] }` to the chart's `{ records }` so the
 *    existing `series`/`xAxis`/`chartType` rendering runs UNCHANGED.
 *
 * The endpoints are session-gated (analytics/admin reads), so the request uses
 * `{ credentials: 'include' }`, mirroring `useKpiSystemValue` /
 * `fetchSystemEndpoint`.
 */

/**
 * Fetches the chart's rows from a system read endpoint and reads the rows array
 * at `rowsKey` (default `'items'`) into the chart's `{ records }` shape.
 *
 * The fetch is the page's ONE entry for this endpoint + static `query`
 * (`systemEnvelopeQueryKey`), shared with every KPI tile and chart reading the
 * same envelope; `rowsKey` is applied in `select`, so two charts reading
 * different arrays of one envelope share the request too. A refused read
 * (401/403/404) and any other failure surface as the error they always did.
 */
export function useChartSystemRecords(system: ChartSystemSource | undefined) {
  const query = useQuery({
    queryKey: systemEnvelopeQueryKey(system),
    enabled: Boolean(system?.endpoint),
    queryFn: () => fetchSystemEnvelope(system),
    select: (result: SystemEnvelopeResult): ChartFetchResult => {
      if (result.kind === 'denied') throw chartReadError(result.status, result.body)
      const json = (result.envelope ?? {}) as Record<string, unknown>
      const rowsKey = system?.rowsKey ?? 'items'
      const records = Array.isArray(json[rowsKey]) ? (json[rowsKey] as readonly TableRecord[]) : []
      return { records }
    },
  })
  const { error } = query
  return error instanceof SystemEnvelopeReadError
    ? { ...query, error: chartReadError(error.status, error.body) }
    : query
}

/** The message the chart's error region shows for a failed read. */
const chartReadError = (status: number, body: string): Error =>
  new Error(`Failed to fetch chart system rows: ${String(status)} ${body}`)
