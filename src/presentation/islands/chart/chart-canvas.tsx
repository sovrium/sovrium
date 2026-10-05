/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BarChartCanvas } from './bar-chart'
import { aggregateRecords, decorateCategories, orderCategories } from './chart-aggregate'
import { buildCategoryData } from './chart-series-shared'
import { LineChartCanvas } from './line-chart'
import { MultiAreaChart } from './multi-area-chart'
import { MultiBarChart } from './multi-bar-chart'
import { MultiLineChart } from './multi-line-chart'
import { PieChartCanvas } from './pie-chart'
import type { ChartAggregateConfig, ChartCategoryOption } from './chart-aggregate'
import type { CategoryDatum, ChartAxisDisplay, ChartSeriesConfig } from './chart-series-shared'
import type { TableRecord } from '../runtime/types'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { ReactElement } from 'react'

/**
 * Chart canvas dispatch — picks the mark a chart draws from its declared
 * `chartType` and binding shape, once the island's guards have established
 * that there are rows to draw.
 *
 * It lives beside the island rather than inside it because the island file is
 * capped for bundle-weight reasons (the per-island `max-lines` eco rule) and
 * because "which canvas" is a decision worth reading on its own: every
 * `chartType` the schema accepts must land on a canvas that draws it, and a
 * type falling through to the wrong branch is silent — the SSR wrapper still
 * carries the declared `data-chart-type` either way.
 */

/** Every mark `ChartTypeSchema` accepts. */
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'scatter'

export interface ChartAxisConfig {
  readonly field: string
  readonly label?: string
  readonly format?: 'date' | 'currency' | 'number' | 'percent'
  readonly scale?: 'linear' | 'logarithmic'
  readonly gridLines?: boolean
}

export interface ChartLegendConfig {
  readonly position?: 'top' | 'bottom' | 'left' | 'right' | 'none'
  readonly visible?: boolean
}

export interface ChartTooltipConfig {
  readonly format?: string
}

/**
 * What the server resolved about the fields a chart names, from `app.tables`:
 * the grouping field's declared options (in declared order, with their labels
 * and colours) and the plotted field's currency display. The island receives
 * records only, never the field schema, so this is how a category keeps its
 * option's place and colour and a currency axis its field's currency.
 */
export interface ChartFieldContext {
  readonly categoryOptions?: readonly ChartCategoryOption[]
  readonly valueCurrency?: CurrencyDisplayOptions
}

/**
 * A pie or donut not grouped by a select field ranks its slices largest first
 * unless `order` says otherwise — what a reader of a share-of-total expects,
 * and what pies drew before categories could be ordered. Every other chart
 * sorts such categories by name.
 */
const PIE_DEFAULT_ORDER = 'value-desc'

/**
 * The two chart types drawn as arcs of a circle rather than as marks against a
 * pair of Cartesian axes. They share one canvas: a donut is a pie with a hole.
 */
function isArcChart(chartType: ChartType | undefined): boolean {
  return chartType === 'pie' || chartType === 'donut'
}

/** True when the chart declares at least one explicit data series. */
function hasSeries(
  series: readonly ChartSeriesConfig[] | undefined
): series is readonly ChartSeriesConfig[] {
  return Array.isArray(series) && series.length > 0
}

/**
 * Everything a series-bound canvas is handed.
 *
 * `yAxis` is a member of this list, and its ABSENCE from it was the whole
 * defect: the schema accepts `label`, `format`, `scale` and `gridLines` on a
 * series chart's value axis, the SSR wrapper forwards them and `ChartCanvas`
 * receives them — and this argument list dropped all four silently, so they
 * validated and drew nothing. A canvas cannot honour what it is never given.
 */
interface SeriesChartArgs {
  readonly records: readonly TableRecord[]
  readonly chartType: ChartType | undefined
  readonly xAxis: ChartAxisConfig | undefined
  readonly yAxis: ChartAxisDisplay | undefined
  readonly series: readonly ChartSeriesConfig[]
  readonly legend: ChartLegendConfig | undefined
  readonly tooltip: ChartTooltipConfig | undefined
  readonly accessibleName: string | undefined
}

/** `bar`/`area` series charts share the same prop shape (no tooltip). */
function renderBarOrAreaSeries(args: SeriesChartArgs, xField: string): ReactElement {
  const { records, chartType, yAxis, series, legend, accessibleName } = args
  const Chart = chartType === 'bar' ? MultiBarChart : MultiAreaChart
  return (
    <Chart
      records={records}
      xField={xField}
      series={series}
      yAxis={yAxis}
      legendPosition={legend?.position}
      legendVisible={legend?.visible}
      accessibleName={accessibleName}
    />
  )
}

/**
 * Renders a multi-series chart with an interactive legend. Each
 * declared `series` entry gets its own visual mark whose shape depends on the
 * `chartType`: `bar` renders grouped/stacked coloured bars, `area` renders
 * filled area paths, `scatter` renders unjoined point marks, and every other
 * type falls back to line series with a hover tooltip. The legend lists every
 * series label.
 */
function renderSeriesChart(args: SeriesChartArgs): ReactElement {
  const { records, chartType, xAxis, yAxis, series, legend, tooltip, accessibleName } = args
  const xField = xAxis?.field ?? ''
  if (chartType === 'bar' || chartType === 'area') {
    return renderBarOrAreaSeries(args, xField)
  }
  return (
    <MultiLineChart
      records={records}
      xField={xField}
      series={series}
      yAxis={yAxis}
      legendPosition={legend?.position}
      legendVisible={legend?.visible}
      tooltipFormat={tooltip?.format}
      variant={chartType === 'scatter' ? 'scatter' : 'line'}
      accessibleName={accessibleName}
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
function renderCategoryChart(args: CategoryChartArgs): ReactElement {
  const { records, chartType, xField, yField, xAxis, yAxis, tooltip, legend, fields } = args
  const { accessibleName } = args
  // Every category takes its option's label and colour, whichever binding fed it.
  const data = decorateCategories(
    args.data ?? buildCategoryData(records, xField, yField),
    fields.categoryOptions
  )
  if (isArcChart(chartType)) {
    // The raw axis pair arrives unordered: its slices follow the field's
    // options when it declares them, and rank largest first otherwise — the
    // order a pie has always drawn. The aggregate binding ordered its own.
    const slices =
      args.data === undefined
        ? orderCategories(data, undefined, fields.categoryOptions, PIE_DEFAULT_ORDER)
        : data
    return (
      <PieChartCanvas
        records={records}
        xField={xField}
        yField={yField}
        data={slices}
        donut={chartType === 'donut'}
        legend={legend}
        accessibleName={accessibleName}
      />
    )
  }
  if (chartType === 'line') {
    return (
      <LineChartCanvas
        data={data}
        accessibleName={accessibleName}
      />
    )
  }
  return (
    <BarChartCanvas
      records={records}
      xField={xField}
      yField={yField}
      data={data}
      xAxis={xAxis}
      yAxis={yAxis}
      tooltip={tooltip}
      accessibleName={accessibleName}
      valueCurrency={fields.valueCurrency}
    />
  )
}

interface AggregatedChartArgs {
  readonly records: readonly TableRecord[]
  readonly chartType: ChartType | undefined
  readonly chartAggregate: ChartAggregateConfig
  /** The chart's `series` — its one entry, when declared, styles the aggregate. */
  readonly series?: readonly ChartSeriesConfig[] | undefined
  readonly xAxis: ChartAxisConfig | undefined
  readonly yAxis: ChartAxisConfig | undefined
  readonly tooltip: ChartTooltipConfig | undefined
  readonly legend: ChartLegendConfig | undefined
  readonly fields: ChartFieldContext
  readonly accessibleName: string | undefined
}

/**
 * Renders an aggregated chart from a `chartAggregate` config: the aggregate
 * names the category field and the value field, and the reduced series is
 * handed to the canvas ready-made.
 *
 * It chooses no mark of its own. This binding once carried its own `line`
 * branch, which is how the two bindings came to disagree about what
 * `chartType: 'line'` draws; every type is now decided in one place, and this
 * function's whole remaining job is to reduce the records before handing them
 * over.
 */
function renderAggregatedChart(args: AggregatedChartArgs): ReactElement {
  const { records, chartAggregate, fields, series } = args
  // ONE series styles the aggregated value: its label names it in the
  // legend, its colour paints the marks. A second entry is refused at boot.
  if (hasSeries(series) && !isArcChart(args.chartType)) {
    return renderStyledAggregate({ ...args, series })
  }
  return renderCategoryChart({
    ...args,
    xField: chartAggregate.groupBy,
    yField: chartAggregate.field ?? '',
    data: aggregateRecords(
      records,
      chartAggregate,
      fields.categoryOptions,
      isArcChart(args.chartType) ? PIE_DEFAULT_ORDER : 'label'
    ),
  })
}

/** The row field a styled aggregate's value is drawn from — never a table field. */
const AGGREGATE_VALUE_FIELD = '__aggregate'

/**
 * An aggregated chart styled by its one series: each group becomes a row
 * `{ <groupBy>: <category name>, __aggregate: <value> }`, drawn by the series
 * chart with the series' label and colour.
 */
function renderStyledAggregate(
  args: AggregatedChartArgs & { readonly series: readonly ChartSeriesConfig[] }
): ReactElement {
  const { records, chartAggregate, fields, series } = args
  const groups = decorateCategories(
    aggregateRecords(records, chartAggregate, fields.categoryOptions, 'label'),
    fields.categoryOptions
  )
  const rows = groups.map((group) => ({
    [chartAggregate.groupBy]: group.label ?? group.key,
    [AGGREGATE_VALUE_FIELD]: group.value,
  }))
  const [styled] = series
  return renderSeriesChart({
    ...args,
    records: rows,
    xAxis: { field: chartAggregate.groupBy },
    series: [{ ...styled, field: AGGREGATE_VALUE_FIELD }],
  })
}

interface AxisBoundChartArgs {
  readonly records: readonly TableRecord[]
  readonly chartType: ChartType | undefined
  readonly xAxis: ChartAxisConfig | undefined
  readonly yAxis: ChartAxisConfig | undefined
  readonly tooltip: ChartTooltipConfig | undefined
  readonly legend: ChartLegendConfig | undefined
  readonly fields: ChartFieldContext
  readonly accessibleName: string | undefined
}

/**
 * Renders the raw `xAxis`/`yAxis` binding — no series array, no aggregate. The
 * axes name the fields and the canvas reduces the records itself.
 */
function renderAxisBoundChart(args: AxisBoundChartArgs): ReactElement {
  return renderCategoryChart({
    ...args,
    xField: args.xAxis?.field ?? '',
    yField: args.yAxis?.field ?? '',
  })
}

export interface ChartCanvasProps {
  readonly records: readonly TableRecord[]
  readonly chartType?: ChartType
  readonly xAxis?: ChartAxisConfig
  readonly yAxis?: ChartAxisConfig
  readonly series?: readonly ChartSeriesConfig[]
  readonly legend?: ChartLegendConfig
  readonly tooltip?: ChartTooltipConfig
  readonly chartAggregate?: ChartAggregateConfig
  readonly accessibleName?: string
  readonly fields?: ChartFieldContext
}

const NO_FIELD_CONTEXT: ChartFieldContext = {}

/**
 * Draws the chart itself. Three bindings, checked in precedence order: an
 * explicit `series` array, a `chartAggregate` config, then the raw
 * `xAxis`/`yAxis` field pair — and within each, the declared `chartType`
 * selects the mark.
 */
export function ChartCanvas({
  records,
  chartType,
  xAxis,
  yAxis,
  series,
  legend,
  tooltip,
  chartAggregate,
  accessibleName,
  fields = NO_FIELD_CONTEXT,
}: ChartCanvasProps): ReactElement {
  // When `chartAggregate` is declared, aggregate records into a `{ key, value }`
  // series — styled by its one `series` entry when it has one.
  if (chartAggregate) {
    return renderAggregatedChart({
      records,
      chartType,
      chartAggregate,
      series,
      xAxis,
      yAxis,
      tooltip,
      legend,
      fields,
      accessibleName,
    })
  }

  // A declared `series` array routes to the multi-series chart.
  if (hasSeries(series)) {
    // One value axis over every series: it prints the currency the series'
    // fields share, which the server resolved only when they all agree.
    const seriesAxis =
      fields.valueCurrency === undefined ? yAxis : { ...yAxis, currency: fields.valueCurrency }
    return renderSeriesChart({
      records,
      chartType,
      xAxis,
      yAxis: seriesAxis,
      series,
      legend,
      tooltip,
      accessibleName,
    })
  }

  const axisArgs = { records, chartType, xAxis, yAxis, tooltip, legend, fields, accessibleName }
  return renderAxisBoundChart(axisArgs)
}
