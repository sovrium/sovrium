/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BarChartCanvas } from './chart/bar-chart'
import {
  ChartEmpty,
  ChartError,
  ChartLoading,
  ChartMissingAxes,
  ChartMissingTable,
} from './chart/chart-states'
import { useChartRecords } from './chart/use-chart-records'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { ReactElement } from 'react'

interface ChartAxisConfig {
  readonly field: string
  readonly label?: string
  readonly format?: 'date' | 'currency' | 'number' | 'percent'
  readonly scale?: 'linear' | 'logarithmic'
  readonly gridLines?: boolean
}

interface ChartIslandProps {
  readonly dataSource?: {
    readonly table: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
  }
  readonly chartType?: 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'scatter'
  readonly xAxis?: ChartAxisConfig
  readonly yAxis?: ChartAxisConfig
  readonly emptyMessage?: string
}

/**
 * Chart island — client-side data-bound visualisation entry point.
 *
 * Foundational implementation covers the bar chart used by US-001 / basic
 * chart specs. Other chart types (line/area/pie/donut/scatter) and the
 * aggregation/series/legend stories layer on top in subsequent specs.
 *
 * The island contract:
 * - Returns `ChartMissingTable` if no `dataSource.table` is configured.
 * - Returns `ChartLoading` while the records query is in flight.
 * - Returns `ChartError` on fetch failure.
 * - Returns `ChartEmpty` (with `emptyMessage`) when zero records come back.
 * - Otherwise renders a visx-backed SVG chart of the requested `chartType`.
 *
 * Each branch emits `data-component="chart"` so spec assertions on that
 * canonical attribute resolve in every state.
 */
interface ChartGuardResult {
  readonly element?: ReactElement
}

/**
 * Walks the early-exit ladder (missing table -> loading -> error -> empty ->
 * missing axes). Returning `element` short-circuits rendering. Pulling the
 * guards out keeps the parent component below the cyclomatic-complexity cap.
 */
function evaluateChartGuards(args: {
  readonly dataSource: ChartIslandProps['dataSource']
  readonly xAxis: ChartIslandProps['xAxis']
  readonly yAxis: ChartIslandProps['yAxis']
  readonly emptyMessage: string | undefined
  readonly isLoading: boolean
  readonly isError: boolean
  readonly error: unknown
  readonly records: readonly unknown[]
}): ChartGuardResult {
  if (!args.dataSource?.table) return { element: <ChartMissingTable /> }
  if (args.isLoading) return { element: <ChartLoading /> }
  if (args.isError) return { element: <ChartError error={args.error} /> }
  if (args.records.length === 0) return { element: <ChartEmpty message={args.emptyMessage} /> }
  if (!args.xAxis?.field || !args.yAxis?.field) return { element: <ChartMissingAxes /> }
  return {}
}

export default function ChartIsland({
  dataSource,
  xAxis,
  yAxis,
  emptyMessage,
}: ChartIslandProps): ReactElement {
  const { data, isLoading, isError, error } = useChartRecords(dataSource)
  const records = data?.records ?? []

  const guard = evaluateChartGuards({
    dataSource,
    xAxis,
    yAxis,
    emptyMessage,
    isLoading,
    isError,
    error,
    records,
  })
  if (guard.element) return guard.element

  // Foundational US-001 implementation only renders the bar variant. The
  // outer SSR placeholder still emits `data-chart-type` so attribute
  // assertions resolve before the bar canvas mounts; future stories will
  // swap in line/area/pie/donut/scatter renderers here.
  return (
    <BarChartCanvas
      records={records}
      xField={xAxis?.field ?? ''}
      yField={yAxis?.field ?? ''}
    />
  )
}
