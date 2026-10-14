/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `radar` and `radial` charts, rendered through recharts on shadcn/ui's
 * chart anatomy: one category per spoke of a radar, its values joined into one
 * closed shape, or one arc per category around a common centre.
 */

import { useMemo } from 'react'
import {
  LabelList,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
} from 'recharts'
import { categoryTooltip } from './category-tooltip'
import { categoryConfig, categoryKey, chartColorVar, paletteColor, seriesKey } from './chart-config'
import { ChartFrame } from './chart-frame'
import type { ChartTooltipConfig } from './chart-canvas-types'
import type { CategoryDatum } from './chart-series-shared'
import type { ChartConfig } from '../parts/chart-primitives'
import type { ReactElement } from 'react'

export interface PolarChartProps {
  readonly data: readonly CategoryDatum[]
  readonly accessibleName?: string
  /** The declared `tooltip`: a callout naming the hovered category and its value. */
  readonly tooltip?: ChartTooltipConfig
}

const POLAR_MARGIN = { top: 16, right: 16, bottom: 16, left: 16 } as const

/** A category as the polar charts read it: its name, value and paint. */
const polarRows = (data: readonly CategoryDatum[], paint: (index: number) => string) =>
  data.map((datum, index) => ({
    key: datum.key,
    name: datum.label ?? datum.key,
    value: datum.value,
    fill: paint(index),
  }))

/** One spoke per category, named at its tip, with the values joined into one shape. */
export function RadarCategoryChart({
  data,
  accessibleName,
  tooltip,
}: PolarChartProps): ReactElement {
  const config: ChartConfig = useMemo(() => ({ [seriesKey(0)]: { color: paletteColor(0) } }), [])
  const rows = useMemo(() => polarRows(data, () => chartColorVar(seriesKey(0))), [data])
  return (
    <ChartFrame config={config}>
      <RadarChart
        data={rows}
        margin={POLAR_MARGIN}
        role="img"
        aria-label={accessibleName ?? 'Radar chart'}
      >
        {categoryTooltip(tooltip)}
        <PolarGrid />
        <PolarAngleAxis dataKey="name" />
        <Radar
          dataKey="value"
          fill={chartColorVar(seriesKey(0))}
          fillOpacity={0.6}
          isAnimationActive={false}
        />
      </RadarChart>
    </ChartFrame>
  )
}

/** One arc per category around a common centre, each named at its start. */
export function RadialCategoryChart({
  data,
  accessibleName,
  tooltip,
}: PolarChartProps): ReactElement {
  const config: ChartConfig = useMemo(() => categoryConfig(data, paletteColor), [data])
  const rows = useMemo(() => polarRows(data, (index) => chartColorVar(categoryKey(index))), [data])
  return (
    <ChartFrame config={config}>
      <RadialBarChart
        data={rows}
        margin={POLAR_MARGIN}
        innerRadius="25%"
        outerRadius="100%"
        role="img"
        aria-label={accessibleName ?? 'Radial chart'}
      >
        {categoryTooltip(tooltip)}
        <RadialBar
          dataKey="value"
          background
          isAnimationActive={false}
        >
          <LabelList
            dataKey="name"
            position="insideStart"
            className="fill-background capitalize mix-blend-luminosity"
            fontSize={11}
          />
        </RadialBar>
      </RadialBarChart>
    </ChartFrame>
  )
}
