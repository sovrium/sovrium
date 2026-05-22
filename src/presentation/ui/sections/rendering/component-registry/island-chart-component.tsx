/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentRenderer } from '../component-dispatch-config'

const CHART_SKELETON_HEIGHTS = ['h-[40%]', 'h-[55%]', 'h-[70%]', 'h-[60%]', 'h-[85%]', 'h-[50%]']

function extractChartProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  return {
    dataSource: elementProps.dataSource,
    chartType: elementProps.chartType,
    xAxis: elementProps.xAxis,
    yAxis: elementProps.yAxis,
    series: elementProps.series,
    legend: elementProps.legend,
    tooltip: elementProps.tooltip,
    chartAggregate: elementProps.chartAggregate,
    emptyMessage: elementProps.emptyMessage,
  }
}

export const islandChartComponent: ComponentRenderer = ({ elementProps }) => {
  const islandProps = extractChartProps(elementProps)
  const propsJson = JSON.stringify(islandProps)
  const chartType = (elementProps.chartType as string | undefined) ?? 'bar'

  return (
    <div
      data-island="chart"
      data-island-props={propsJson}
      data-component-type="chart"
      data-chart-type={chartType}
      data-testid={elementProps['data-testid'] as string | undefined}
    >
      {}
      <div
        className="border-border bg-background-raised w-full rounded-lg border p-4"
        aria-label="Loading chart..."
        role="status"
      >
        <div className="bg-background-subtle mb-3 h-4 w-32 animate-pulse rounded" />
        <div className="flex h-48 items-end gap-3">
          {CHART_SKELETON_HEIGHTS.map((cls, i) => (
            <div
              key={`chart-skeleton-${String(i)}`}
              className={`bg-background-subtle flex-1 animate-pulse rounded-t ${cls}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
