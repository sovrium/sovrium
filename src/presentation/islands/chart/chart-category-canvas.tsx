/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ArcChart } from './arc-chart'
import { CategoryBarChart, CategoryLineChart } from './category-charts'
import { decorateCategories, orderCategories } from './chart-aggregate'
import { buildCategoryData } from './chart-series-shared'
import { RadarCategoryChart, RadialCategoryChart } from './polar-charts'
import type {
  ChartAxisConfig,
  ChartFieldContext,
  ChartLegendConfig,
  ChartTooltipConfig,
  ChartType,
} from './chart-canvas-types'
import type { CategoryDatum } from './chart-series-shared'
import type { TableRecord } from '../runtime/types'
import type { ReactElement } from 'react'

/**
 * A pie or donut not grouped by a select field ranks its slices largest first
 * unless `order` says otherwise — what a reader of a share-of-total expects,
 * and what pies drew before categories could be ordered. Every other chart
 * sorts such categories by name.
 */
export const PIE_DEFAULT_ORDER = 'value-desc'

/**
 * The two chart types drawn as arcs of a circle rather than as marks against a
 * pair of Cartesian axes. They share one canvas: a donut is a pie with a hole.
 */
export function isArcChart(chartType: ChartType | undefined): boolean {
  return chartType === 'pie' || chartType === 'donut'
}

/**
 * Each category named from `nameKey`, a field of the first record in it, when
 * the legend or the tooltip names one: a plan's display name beside its code.
 */
function nameCategories(
  data: readonly CategoryDatum[],
  records: readonly TableRecord[],
  xField: string,
  nameKey: string | undefined
): readonly CategoryDatum[] {
  if (nameKey === undefined) return data
  return data.map((datum) => {
    const name = records.find((record) => String(record[xField]) === datum.key)?.[nameKey]
    return name == null ? datum : { ...datum, label: String(name) }
  })
}

/** A radar or a radial chart, or nothing for any other type. */
function renderPolarChart(
  chartType: ChartType | undefined,
  data: readonly CategoryDatum[],
  args: Pick<CategoryChartArgs, 'accessibleName' | 'tooltip'>
): ReactElement | undefined {
  if (chartType !== 'radar' && chartType !== 'radial') return undefined
  const Polar = chartType === 'radar' ? RadarCategoryChart : RadialCategoryChart
  return (
    <Polar
      data={data}
      accessibleName={args.accessibleName}
      tooltip={args.tooltip}
    />
  )
}

interface CategoryChartArgs {
  readonly records: readonly TableRecord[]
  readonly chartType: ChartType | undefined
  /** The row field naming each category, however the binding derived it. */
  readonly xField: string
  /** The row field holding each category's value, however the binding derived it. */
  readonly yField: string
  /**
   * A pre-aggregated `{ key, value }` series, when the binding had one. Absent
   * for the raw axis binding, where both canvases reduce the records
   * themselves — `undefined` and omitted mean the same thing to each.
   */
  readonly data?: readonly CategoryDatum[]
  readonly xAxis: ChartAxisConfig | undefined
  readonly yAxis: ChartAxisConfig | undefined
  /**
   * The chart's declared `tooltip`, forwarded so the bar canvas can draw the
   * hover callout. It arrives here from BOTH remaining bindings — the
   * aggregate and the raw axis pair — because the callout belongs to the
   * chart, not to the binding that fed it; forwarding it down only one branch
   * is exactly how `tooltip.format` came to be a schema option an
   * aggregate-bound chart silently ignored.
   */
  readonly tooltip: ChartTooltipConfig | undefined
  /** The declared legend — a pie or donut lists one entry per slice. */
  readonly legend: ChartLegendConfig | undefined
  readonly fields: ChartFieldContext
  readonly accessibleName: string | undefined
}

/**
 * Draws one mark per CATEGORY: an arc for `pie`/`donut`, a joined line for
 * `line`, a bar for everything else.
 *
 * The two record-driven bindings below — an aggregate and a raw axis pair —
 * differ in how they name the fields and in whether they arrive pre-aggregated,
 * and in nothing else. Choosing the mark is therefore written HERE, once. It
 * was written in both, and that is the precise shape of the defect this module
 * exists to prevent: `pie`, `donut` and `scatter` each drew someone else's mark
 * for months, and correcting them had to touch every branch that decided. A
 * seventh chart type should be one edit, not two that must agree.
 *
 * `line` was the last type still decided outside this function, and it was the
 * last type still drawn wrong: the aggregate binding had a branch for it and the
 * raw axis pair never did, so an author who declared `chartType: 'line'` beside
 * an `xAxis` and a `yAxis` got bars. The line canvas wants a reduced series
 * rather than field names, which is what kept it out — but the reduction is the
 * same one the bar canvas already performs on those same two fields, so it is
 * performed here when the binding did not arrive with one.
 */
export function renderCategoryChart(args: CategoryChartArgs): ReactElement {
  const { records, chartType, xField, yField, legend, fields } = args
  // Every category takes its option's label and colour, whichever binding fed it.
  const data = nameCategories(
    decorateCategories(
      args.data ?? buildCategoryData(records, xField, yField),
      fields.categoryOptions
    ),
    records,
    xField,
    legend?.nameKey ?? args.tooltip?.nameKey
  )
  if (isArcChart(chartType)) {
    // A raw axis pair is unordered: option order, else largest first.
    const slices =
      args.data === undefined
        ? orderCategories(data, undefined, fields.categoryOptions, PIE_DEFAULT_ORDER)
        : data
    return (
      <ArcChart
        data={slices}
        donut={chartType === 'donut'}
        legend={legend}
        tooltip={args.tooltip}
        accessibleName={args.accessibleName}
        dataLabels={fields.dataLabels}
      />
    )
  }
  const polar = renderPolarChart(chartType, data, args)
  if (polar !== undefined) return polar
  const Chart = chartType === 'line' ? CategoryLineChart : CategoryBarChart
  return (
    <Chart
      data={data}
      xAxis={args.xAxis}
      yAxis={args.yAxis}
      tooltip={args.tooltip}
      fields={fields}
      accessibleName={args.accessibleName}
    />
  )
}
