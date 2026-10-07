/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeChartShellClasses } from '@/presentation/design/chart-default-classes'
import { hostClassName, namedHost } from '@/presentation/render/registry/island-host-attributes'
import type { ComponentRenderer } from './component-dispatch-config'

/**
 * Tailwind height classes for the 6-bar SSR chart skeleton. Defined at module
 * scope so the JSX never allocates an inline `style={{ height: … }}` object
 * (react-perf/jsx-no-new-object-as-prop).
 */
const CHART_SKELETON_HEIGHTS = ['h-[40%]', 'h-[55%]', 'h-[70%]', 'h-[60%]', 'h-[85%]', 'h-[50%]']

/**
 * Extracts chart island props from section component props.
 *
 * Forwarded to the chart island for client-side data fetching, optional
 * aggregation, and visx-based SVG rendering (bar/line/area/scatter via
 * @visx/xychart, pie/donut via @visx/shape).
 */
function extractChartProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  return {
    // Accessible name for the rendered `<svg role="img">`
    // Forwarded so the
    // island can override the generic per-`chartType` default (e.g. "Area
    // chart") with a meaningful operator-set name, exactly as a `table`
    // labels its `role="grid"` via `props['aria-label']`. Omitted → the
    // per-type default is preserved (additive override, never a default change).
    ariaLabel: elementProps['aria-label'],
    dataSource: elementProps.dataSource,
    chartType: elementProps.chartType,
    xAxis: elementProps.xAxis,
    yAxis: elementProps.yAxis,
    series: elementProps.series,
    legend: elementProps.legend,
    tooltip: elementProps.tooltip,
    chartAggregate: elementProps.chartAggregate,
    dataLabels: elementProps.dataLabels,
    // What `app.tables` says about the fields the chart names: the grouping
    // field's options (order, labels, colours) and the plotted field's
    // currency. Absent when the chart names no such field.
    categoryOptions: elementProps.categoryOptions,
    valueCurrency: elementProps.valueCurrency,
    // Read the figures from one aggregate read rather than a page of records.
    aggregateRead: elementProps.aggregateRead,
    emptyMessage: elementProps.emptyMessage,
    // Optional NAMED empty-state region config
    // Forwarded so the
    // island's zero-rows branch renders an accessible `role="region"` landmark
    // (name + title) instead of the unnamed default empty placeholder. Omitted →
    // the plain unnamed `ChartEmpty` is preserved (purely additive).
    emptyState: elementProps.emptyState,
  }
}

/**
 * SSR placeholder for the chart island. The outer wrapper carries
 * `data-island="chart"` (so the runtime can mount the React component) plus
 * `data-chart-type` (so spec attribute assertions resolve before hydration).
 *
 * The wrapper is also the ONE element naming the chart (`data-component`
 * beside `data-component-type`): nothing the island draws inside it carries
 * either, so a reader counting by either attribute finds one chart.
 */
export const islandChartComponent: ComponentRenderer = ({ elementProps }) => {
  const islandProps = extractChartProps(elementProps)
  const propsJson = JSON.stringify(islandProps)
  const chartType = (elementProps.chartType as string | undefined) ?? 'bar'

  return (
    <div
      data-island="chart"
      data-island-props={propsJson}
      {...namedHost('chart')}
      data-chart-type={chartType}
      data-testid={elementProps['data-testid'] as string | undefined}
      className={hostClassName(elementProps)}
    >
      {/* Loading skeleton — preserved as Suspense fallback.
       * Shell chrome (border + radius + raised surface + the canvas'
       * 10px/12px inset) painted via the CHART recipe, so the var-fallback
       * paints the surface even when the theme layer is absent — and so the
       * placeholder is the same card the hydrated island renders. It carries
       * its own `w-full`, so none is added here.
       *
       * Not `data-default-classes.ts`'s same-named `computeChartShellClasses`,
       * which paints the design-system reference app's chart SIMULACRUM (`p-4`
       * on `sv-bg`) and is pinned by that file's test — a different surface
       * that happens to share a name. */}
      <div
        className={computeChartShellClasses()}
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
