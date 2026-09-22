/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeChartShellClasses } from '@/presentation/design/chart-default-classes'
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
    //: forwarded so the
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
    emptyMessage: elementProps.emptyMessage,
    // Optional NAMED empty-state region config
    //: forwarded so the
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
 * `data-component="chart"` lives on the inner ChartCanvas/empty-state in the
 * island itself — keeping it off the outer wrapper avoids strict-mode
 * locator collisions in Playwright specs.
 */
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
      {/* Loading skeleton — preserved as Suspense fallback.
       * [internal ref]: shell chrome (border + radius + raised surface + the canvas'
       * 10px/12px inset) painted via the CHART recipe, so the var-fallback
       * paints the surface even when the theme layer is absent — and so the
       * placeholder is the same card the hydrated island renders. It carries
       * its own `w-full`, so none is added here.
       *
       * This used to spend `data-default-classes.ts`'s same-named
       * `computeChartShellClasses`, which paints the design-system reference
       * app's chart SIMULACRUM (`p-4` on `sv-bg`) and is pinned by that file's
       * test — a different surface that happened to share a name. */}
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
