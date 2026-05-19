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

interface ChartGuardResult {
  readonly element?: ReactElement
}

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

  return (
    <BarChartCanvas
      records={records}
      xField={xAxis?.field ?? ''}
      yField={yAxis?.field ?? ''}
    />
  )
}
