/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The card every chart is drawn in: the plot ({@link ChartContainer}) and, when
 * the chart declares one, its legend on the side `legend.position` names.
 *
 * `legend.position` is a PLACEMENT — which of the plot's four edges the legend
 * occupies. `top`, `left` and an absent position put the legend first in
 * reading order; `left` and `right` put it beside the plot rather than above or
 * below it. `none`, or `visible: false`, draws no legend.
 *
 * The plot carries `data-chart-body`: a placement can only be asserted against
 * the box the legend is placed relative to, and that box is the plot.
 */

import { useMemo } from 'react'
import {
  CHART_FIXED_BODY,
  computeChartBodyClasses,
  computeChartLayoutClasses,
  computeChartShellClasses,
} from '@/presentation/design/chart-default-classes'
import { ChartContainer, ChartLegendContent } from '../parts/chart-primitives'
import type { LegendPosition } from './chart-series-shared'
import type { ChartConfig, ChartLegendEntry } from '../parts/chart-primitives'
import type { ReactElement, ReactNode } from 'react'

const SHELL_CLASSES = computeChartShellClasses()
const BODY_CLASSES = computeChartBodyClasses()
const BODY_BESIDE_CLASSES = computeChartBodyClasses({ beside: true })
const LAYOUT_CLASSES = computeChartLayoutClasses()
const LAYOUT_BESIDE_CLASSES = computeChartLayoutClasses({ beside: true })

/** A chart's declared legend, as the frame reads it. */
export interface ChartFrameLegend {
  readonly position?: LegendPosition
  readonly visible?: boolean
  readonly entries: readonly ChartLegendEntry[]
  /** Present on a series legend, whose entries toggle their series. */
  readonly onToggle?: (id: string) => void
}

/** Is a legend declared and shown? Absent, hidden or `none` draws none. */
const showsLegend = (legend: ChartFrameLegend | undefined): legend is ChartFrameLegend =>
  legend !== undefined && legend.visible !== false && legend.position !== 'none'

/** The class of the plot: filling a fixed box, beside a side legend, else sized by its width. */
const bodyClassesOf = (fixed: boolean, beside: boolean): string =>
  fixed ? CHART_FIXED_BODY : beside ? BODY_BESIDE_CLASSES : BODY_CLASSES

/**
 * The plot: the container sized by the width, or, with a declared `height`,
 * filling a box of that many pixels — a number no class can carry, so it sits
 * on the element holding the plot.
 */
function ChartPlot({
  config,
  height,
  beside,
  children,
}: {
  readonly config: ChartConfig
  readonly height: number | undefined
  readonly beside: boolean
  readonly children: ReactNode
}): ReactElement {
  const fixed = useMemo(() => (height === undefined ? undefined : { height }), [height])
  const body = (
    <ChartContainer
      config={config}
      className={bodyClassesOf(fixed !== undefined, beside)}
      data-chart-body="true"
    >
      {children}
    </ChartContainer>
  )
  if (fixed === undefined) return body
  return (
    <div
      className="w-full"
      style={fixed}
    >
      {body}
    </div>
  )
}

export function ChartFrame({
  config,
  legend,
  height,
  children,
}: {
  readonly config: ChartConfig
  readonly legend?: ChartFrameLegend
  /** A fixed plot height in pixels, the same at every width; absent, it follows the width. */
  readonly height?: number
  /** The recharts chart, sized by the container. */
  readonly children: ReactNode
}): ReactElement {
  const position = legend?.position
  const beside = showsLegend(legend) && (position === 'left' || position === 'right')
  const plot = (
    <ChartPlot
      config={config}
      height={height}
      beside={beside}
    >
      {children}
    </ChartPlot>
  )
  if (!showsLegend(legend)) return <div className={SHELL_CLASSES}>{plot}</div>
  const legendNode = (
    <ChartLegendContent
      entries={legend.entries}
      onToggle={legend.onToggle}
      column={beside}
    />
  )
  const legendFirst = position !== 'bottom' && position !== 'right'
  return (
    <div className={SHELL_CLASSES}>
      <div className={beside ? LAYOUT_BESIDE_CLASSES : LAYOUT_CLASSES}>
        {legendFirst ? legendNode : plot}
        {legendFirst ? plot : legendNode}
      </div>
    </div>
  )
}
