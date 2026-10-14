/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The bar and line charts of one value per category — an aggregate's groups,
 * or a raw axis pair reduced to them — drawn as one series.
 */

import { useCallback, useMemo } from 'react'
import { CartesianChart, type CartesianTooltip } from './cartesian-chart'
import { categoryConfig, categoryKey, chartColorVar, paletteColor, seriesKey } from './chart-config'
import {
  axisKeyLabeller,
  formatAxisLabel,
  formatAxisValue,
  monthKeyLabeller,
  timeKeyLabeller,
} from './chart-format'
import type { CartesianRowInput } from './cartesian-rows'
import type { ChartAxisConfig, ChartFieldContext, ChartTooltipConfig } from './chart-canvas-types'
import type { CategoryDatum } from './chart-series-shared'
import type { ChartConfig } from '../parts/chart-primitives'
import type { ReactElement } from 'react'

/** The one series a category chart draws: the category values, in palette slot 1. */
const VALUE_FIELD = 'value'
const CATEGORY_SERIES = [{ key: seriesKey(0), field: VALUE_FIELD, label: VALUE_FIELD }] as const

/** One row per category, its value under the one series' field. */
const categoryRows = (data: readonly CategoryDatum[], fill?: (index: number) => string) =>
  data.map((datum, index): CartesianRowInput => ({
    key: datum.key,
    ...(datum.label === undefined ? {} : { label: datum.label }),
    ...(fill === undefined ? {} : { fill: fill(index) }),
    raw: { [VALUE_FIELD]: datum.value },
  }))

/** What a category bar or line chart is drawn from. */
export interface CategoryChartProps {
  readonly data: readonly CategoryDatum[]
  readonly xAxis: ChartAxisConfig | undefined
  readonly yAxis: ChartAxisConfig | undefined
  /** The declared `tooltip`: a bar chart draws a callout reading the hovered category. */
  readonly tooltip: ChartTooltipConfig | undefined
  readonly fields: ChartFieldContext
  readonly accessibleName: string | undefined
}

/** The value axis' tick label, in the axis' declared format and the field's currency. */
function useValueLabel(
  yAxis: ChartAxisConfig | undefined,
  fields: ChartFieldContext
): (value: number) => string {
  const format = yAxis?.format
  const currency = fields.valueCurrency
  return useCallback(
    (value: number) => formatAxisValue(value, format, currency),
    [format, currency]
  )
}

/**
 * A line through the categories, in palette slot 1. Its category axis reads a
 * month bucket as its month, and with `format: date` an instant as its time.
 */
export function CategoryLineChart(args: CategoryChartProps): ReactElement {
  const { data, xAxis, yAxis, fields } = args
  const rows = useMemo(() => categoryRows(data), [data])
  const categoryLabel = useMemo(() => {
    const keys = data.map((datum) => datum.key)
    const labeller =
      (xAxis?.format === 'date' ? timeKeyLabeller(keys) : undefined) ?? monthKeyLabeller(keys)
    return (key: string): string => labeller?.(key) ?? key
  }, [data, xAxis?.format])
  const valueLabel = useValueLabel(yAxis, fields)
  return (
    <CartesianChart
      mark="line"
      rows={rows}
      series={CATEGORY_SERIES}
      config={CATEGORY_SERIES_CONFIG}
      scale={yAxis?.scale}
      categoryLabel={categoryLabel}
      valueLabel={valueLabel}
      barKeyOf="category"
      accessibleName={args.accessibleName ?? 'Line chart'}
    />
  )
}

/** The palette slot every category chart's one series is painted in. */
const CATEGORY_SERIES_CONFIG: ChartConfig = {
  [seriesKey(0)]: { label: VALUE_FIELD, color: paletteColor(0) },
}

/**
 * One bar per category, painted by the category's own colour (its option's,
 * or the chart's `chartAggregate.color`), else palette slot 1. A declared
 * `tooltip` arms a callout reading the hovered category.
 */
export function CategoryBarChart(args: CategoryChartProps): ReactElement {
  const { data, xAxis, yAxis, tooltip, fields } = args
  const painted = data.some((datum) => datum.color !== undefined)
  const config = useMemo<ChartConfig>(
    () =>
      painted
        ? { ...CATEGORY_SERIES_CONFIG, ...categoryConfig(data, () => paletteColor(0)) }
        : CATEGORY_SERIES_CONFIG,
    [data, painted]
  )
  const rows = useMemo(
    () => categoryRows(data, painted ? (index) => chartColorVar(categoryKey(index)) : undefined),
    [data, painted]
  )
  const categoryLabel = useMemo(() => {
    const keyLabel = axisKeyLabeller(
      data.map((datum) => datum.key),
      xAxis?.format
    )
    const labels = new Map(
      data.map((datum) => [
        datum.key,
        datum.label === undefined
          ? keyLabel(datum.key)
          : formatAxisLabel(datum.label, xAxis?.format),
      ])
    )
    return (key: string): string => labels.get(key) ?? key
  }, [data, xAxis?.format])
  const callout = useMemo<CartesianTooltip | undefined>(
    () => (tooltip === undefined ? undefined : { ...tooltip, labelOf: 'category' }),
    [tooltip]
  )
  const valueLabel = useValueLabel(yAxis, fields)
  return (
    <CartesianChart
      mark="bar"
      rows={rows}
      series={CATEGORY_SERIES}
      config={config}
      scale={yAxis?.scale}
      categoryLabel={categoryLabel}
      valueLabel={valueLabel}
      barKeyOf="category"
      xTitle={xAxis?.label}
      yTitle={yAxis?.label}
      gridLines={xAxis?.gridLines === true || yAxis?.gridLines === true}
      tooltip={callout}
      accessibleName={args.accessibleName ?? 'Bar chart'}
    />
  )
}
