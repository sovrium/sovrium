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

import {
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

export function ChartFrame({
  config,
  legend,
  children,
}: {
  readonly config: ChartConfig
  readonly legend?: ChartFrameLegend
  /** The recharts chart, sized by the container. */
  readonly children: ReactNode
}): ReactElement {
  const position = legend?.position
  const beside = showsLegend(legend) && (position === 'left' || position === 'right')
  const plot = (
    <ChartContainer
      config={config}
      className={beside ? BODY_BESIDE_CLASSES : BODY_CLASSES}
      data-chart-body="true"
    >
      {children}
    </ChartContainer>
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
