/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { computeChartShellClasses } from '@/presentation/design/chart-default-classes'
import { resolveLucideIconNode } from '@/presentation/render/elements/lucide-resolver'
import { hostClassName, namedHost } from '@/presentation/render/registry/island-host-attributes'
import { islandLoadingLabel, islandUiStrings } from './island-loading-label'
import { islandFallback, specimenEmpty } from './specimen-island-states'
import type { ComponentRenderer } from './component-dispatch-config'

/**
 * Tailwind height classes for the 6-bar SSR chart skeleton. Defined at module
 * scope so the JSX never allocates an inline `style={{ height: … }}` object
 * (react-perf/jsx-no-new-object-as-prop).
 */
const CHART_SKELETON_HEIGHTS = ['h-[40%]', 'h-[55%]', 'h-[70%]', 'h-[60%]', 'h-[85%]', 'h-[50%]']

/** Each series' `icon`, resolved to the geometry the island draws (no icon set ships to the client). */
const withSeriesIcons = (series: unknown): unknown =>
  Array.isArray(series)
    ? series.map((entry: Readonly<Record<string, unknown>>) =>
        typeof entry['icon'] === 'string'
          ? { ...entry, iconNode: resolveLucideIconNode(entry['icon']) }
          : entry
      )
    : series

/**
 * Extracts chart island props from section component props.
 *
 * Forwarded to the chart island for client-side data fetching, optional
 * aggregation, and SVG rendering through recharts (bar, line, area, scatter,
 * pie and donut).
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
    series: withSeriesIcons(elementProps.series),
    legend: elementProps.legend,
    tooltip: elementProps.tooltip,
    chartAggregate: elementProps.chartAggregate,
    dataLabels: elementProps.dataLabels,
    // How much is drawn around the marks: a fixed plot height, the `strip`
    // variant, and the bar colour rules. Absent unless declared.
    height: elementProps.height,
    chartVariant: elementProps.chartVariant,
    barColor: elementProps.barColor,
    // The window `chartAggregate.fillEmpty` draws every bucket of, resolved
    // on the server's clock; absent unless the chart fills.
    fillWindow: elementProps.fillWindow,
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
 * The accessible name of a chart that declares none, by what it draws
 * (`chartName.<type>`), in the page language — sent only where it differs
 * from the English the island names it with, so an English page is unchanged.
 */
const untitledChartName = (
  chartType: string,
  currentLang: string | undefined,
  languages: Parameters<typeof islandUiStrings>[2]
): { readonly ariaLabel?: string } => {
  const key = `chartName.${chartType}`
  const name = resolveInterpreterString(key, currentLang, languages)
  return name === key || name === resolveInterpreterString(key, 'en', undefined)
    ? {}
    : { ariaLabel: name }
}

/**
 * The name a chart's folded remainder takes when the author named none
 * (`chart.other`), in the page language — written into `otherLabel` only where
 * it differs from the island's English « Other », so an English page is
 * unchanged and the island ships no catalogue.
 */
const withOtherLabel = (
  aggregate: unknown,
  currentLang: string | undefined,
  languages: Parameters<typeof islandUiStrings>[2]
): { readonly chartAggregate?: unknown } => {
  const config = aggregate as { readonly limit?: number; readonly otherLabel?: string } | undefined
  if (config?.limit === undefined || config.otherLabel !== undefined) return {}
  const other = resolveInterpreterString('chart.other', currentLang, languages)
  return other === 'Other' ? {} : { chartAggregate: { ...config, otherLabel: other } }
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
export const islandChartComponent: ComponentRenderer = ({
  elementProps,
  currentLang,
  languages,
}) => {
  const loading = islandLoadingLabel('chart.loading', currentLang, languages)
  const chartType = (elementProps.chartType as string | undefined) ?? 'bar'
  const extracted = extractChartProps(elementProps)
  const islandProps = {
    ...extracted,
    ...(extracted.ariaLabel === undefined && untitledChartName(chartType, currentLang, languages)),
    ...withOtherLabel(extracted.chartAggregate, currentLang, languages),
    uiStrings: islandUiStrings('chart', currentLang, languages),
  }
  const propsJson = JSON.stringify(islandProps)

  return (
    <div
      id={elementProps.id as string | undefined}
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
       * on `background`) and is pinned by that file's test — a different surface
       * that happens to share a name. */}
      {islandFallback(
        <div
          className={computeChartShellClasses()}
          data-loading-status=""
          aria-label={loading.status}
          role="status"
        >
          <div className="bg-muted mb-3 h-4 w-32 animate-pulse rounded" />
          <div className="flex h-48 items-end gap-3">
            {CHART_SKELETON_HEIGHTS.map((cls, i) => (
              <div
                key={`chart-skeleton-${String(i)}`}
                className={`bg-muted flex-1 animate-pulse rounded-t ${cls}`}
              />
            ))}
          </div>
        </div>,
        () => specimenEmpty('chart.empty', currentLang, languages)
      )}
    </div>
  )
}
