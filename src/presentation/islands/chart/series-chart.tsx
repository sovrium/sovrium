/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The series-bound chart: one mark per declared `series` entry, over one row
 * per distinct X value of the records, with a legend toggling each series.
 */

import { useCallback, useMemo } from 'react'
import { CartesianChart, type CartesianTooltip } from './cartesian-chart'
import { seriesConfig, seriesKey } from './chart-config'
import { dayKeyLabeller, formatAxisValue, timeKeyLabeller } from './chart-format'
import { numericValue, xKeys } from './chart-series-shared'
import { barPaintOf, useChartShape, type ChartBarColorRule } from './chart-shape'
import type { CartesianMark } from './cartesian-marks'
import type { CartesianRowInput } from './cartesian-rows'
import type {
  ChartAxisConfig,
  ChartLegendConfig,
  ChartTooltipConfig,
  ChartType,
} from './chart-canvas-types'
import type { ChartAxisDisplay, ChartSeriesConfig } from './chart-series-shared'
import type { TableRecord } from '../runtime/types'
import type { ReactElement } from 'react'

/**
 * Everything a series-bound canvas is handed.
 *
 * `yAxis` is a member of this list, and its ABSENCE from it was the whole
 * defect: the schema accepts `label`, `format`, `scale` and `gridLines` on a
 * series chart's value axis, the SSR wrapper forwards them and `ChartCanvas`
 * receives them — and this argument list dropped all four silently, so they
 * validated and drew nothing. A canvas cannot honour what it is never given.
 */
export interface SeriesChartArgs {
  readonly records: readonly TableRecord[]
  readonly chartType: ChartType | undefined
  readonly xAxis: ChartAxisConfig | undefined
  readonly yAxis: ChartAxisDisplay | undefined
  readonly series: readonly ChartSeriesConfig[]
  readonly legend: ChartLegendConfig | undefined
  readonly tooltip: ChartTooltipConfig | undefined
  readonly accessibleName: string | undefined
}

/** The mark a series chart draws: bars, areas, unjoined points, else lines. */
function seriesMarkOf(chartType: ChartType | undefined): CartesianMark {
  if (chartType === 'bar' || chartType === 'area' || chartType === 'scatter') return chartType
  return 'line'
}

/** The default accessible name of each mark. */
const DEFAULT_NAMES: { readonly [Mark in CartesianMark]: string } = {
  bar: 'Bar chart',
  area: 'Area chart',
  scatter: 'Scatter chart',
  line: 'Line chart',
}

/**
 * One row per distinct X value, in the order the records first name it, each
 * series' value read off the first record naming it.
 */
function seriesRows(
  records: readonly TableRecord[],
  xField: string,
  series: readonly ChartSeriesConfig[],
  keys: Pick<ChartTooltipConfig, 'labelKey' | 'nameKey'> & {
    readonly barColor?: readonly ChartBarColorRule[]
  } = {}
): readonly CartesianRowInput[] {
  const textOf = (record: TableRecord | undefined, field: string | undefined) =>
    field === undefined || record?.[field] == null ? undefined : String(record[field])
  return xKeys(records, xField).map((key) => {
    const record = records.find((candidate) => String(candidate[xField]) === key)
    const heading = textOf(record, keys.labelKey)
    const name = textOf(record, keys.nameKey)
    // A `barColor` rule the row's record matches paints its bars in the rule's tone.
    const paint = barPaintOf(keys.barColor, record)
    return {
      key,
      ...paint,
      ...(heading === undefined ? {} : { heading }),
      ...(name === undefined ? {} : { name }),
      raw: Object.fromEntries(
        series.map((s) => [s.field, record === undefined ? 0 : numericValue(record[s.field])])
      ),
    }
  })
}

/** The category and value tick labellers of a series chart. */
function useAxisLabels(
  rows: readonly CartesianRowInput[],
  xAxis: ChartAxisConfig | undefined,
  yAxis: ChartAxisDisplay | undefined
): {
  readonly categoryLabel: (key: string) => string
  readonly valueLabel: (value: number) => string
} {
  const xFormat = xAxis?.format
  const categoryLabel = useMemo(() => {
    const keys = rows.map((row) => row.key)
    const labeller =
      (xFormat === 'date' ? timeKeyLabeller(keys) : undefined) ?? dayKeyLabeller(keys)
    return (key: string): string => labeller?.(key) ?? key
  }, [rows, xFormat])
  const format = yAxis?.format
  const currency = yAxis?.currency
  const valueLabel = useCallback(
    (value: number) => formatAxisValue(value, format, currency),
    [format, currency]
  )
  return { categoryLabel, valueLabel }
}

/**
 * A line or a scatter chart draws a callout whether or not a `tooltip` is
 * declared (the template is optional); a bar or an area chart draws one when
 * a `tooltip` is declared.
 */
function useCallout(
  mark: CartesianMark,
  tooltip: ChartTooltipConfig | undefined
): CartesianTooltip | undefined {
  return useMemo(
    () =>
      mark === 'line' || mark === 'scatter' || tooltip !== undefined
        ? { ...tooltip, labelOf: 'series' }
        : undefined,
    [mark, tooltip]
  )
}

/** A series chart always draws its legend, above the plot unless told otherwise. */
function useLegendConfig(legend: ChartLegendConfig | undefined): ChartLegendConfig {
  const position = legend?.position ?? 'top'
  const visible = legend?.visible
  return useMemo(() => ({ position, visible }), [position, visible])
}

/** The `barColor` rules a bar chart paints by; no other mark reads them. */
function useBarColor(mark: CartesianMark): readonly ChartBarColorRule[] | undefined {
  const { barColor } = useChartShape()
  return mark === 'bar' ? barColor : undefined
}

/** Is the category axis placed by time (`xAxis.scale: time`)? */
const isTimeScale = (xAxis: ChartAxisConfig | undefined): boolean => xAxis?.scale === 'time'

/**
 * Renders a multi-series chart with an interactive legend. Each declared
 * `series` entry gets its own mark, shaped by the `chartType`: `bar` draws
 * grouped or stacked bars, `area` filled areas, `scatter` unjoined points, and
 * every other type a line. A line or a scatter chart draws a callout on hover.
 */
export function SeriesChart(args: SeriesChartArgs): ReactElement {
  const { records, chartType, xAxis, yAxis, series, legend, tooltip } = args
  const xField = xAxis?.field ?? ''
  const mark = seriesMarkOf(chartType)
  const labelKey = tooltip?.labelKey
  const nameKey = tooltip?.nameKey
  const barColor = useBarColor(mark)
  const rows = useMemo(
    () => seriesRows(records, xField, series, { labelKey, nameKey, barColor }),
    [records, xField, series, labelKey, nameKey, barColor]
  )
  const config = useMemo(() => seriesConfig(series), [series])
  const drawn = useMemo(
    () =>
      series.map((s, index) => ({
        key: seriesKey(index),
        field: s.field,
        label: s.label ?? s.field,
        ...(s.stack === undefined ? {} : { stack: s.stack }),
        ...(s.fillOpacity === undefined ? {} : { fillOpacity: s.fillOpacity }),
        ...(s.iconNode === undefined ? {} : { iconNode: s.iconNode }),
      })),
    [series]
  )
  const { categoryLabel, valueLabel } = useAxisLabels(rows, xAxis, yAxis)
  const callout = useCallout(mark, tooltip)
  const legendConfig = useLegendConfig(legend)
  return (
    <CartesianChart
      mark={mark}
      rows={rows}
      series={drawn}
      config={config}
      scale={yAxis?.scale}
      categoryLabel={categoryLabel}
      valueLabel={valueLabel}
      barKeyOf="series"
      yTitle={yAxis?.label}
      gridLines={yAxis?.gridLines === true}
      tooltip={callout}
      legend={legendConfig}
      accessibleName={args.accessibleName ?? DEFAULT_NAMES[mark]}
      timeScale={isTimeScale(xAxis)}
    />
  )
}
