/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Bar } from '@visx/shape'
import { useCallback, useState } from 'react'
import {
  CHART_BAR_RADIUS,
  CHART_TOOLTIP_HEIGHT,
  CHART_TOOLTIP_POINT_GAP,
} from '@/presentation/design/chart-default-classes'
import { PRIMARY_SERIES_PAINT } from './chart-series-shared'
import { ChartTooltip, type TooltipState } from './chart-tooltip'
import type { CategoryDatum, ChartValueScale } from './chart-series-shared'
import type { scaleBand } from '@visx/scale'
import type { ReactElement } from 'react'

/**
 * The bars of a single-series bar chart, plus the hover callout they drive.
 *
 * This lives beside `bar-chart.tsx` rather than inside it because that file is
 * already close to its line ceiling, and because the hover callout is a layer
 * with its own state: the bars are otherwise pure geometry, and keeping the
 * `useState` here is what lets the rest of the canvas stay a plain projection
 * of the scales.
 */

type BandScale = ReturnType<typeof scaleBand<string>>

/**
 * The chart's declared `tooltip` block, as the canvas reads it.
 *
 * Its PRESENCE is what arms the callout — not the presence of a `format`
 * inside it. A chart declaring no `tooltip` gets no hover listeners and no
 * callout layer at all, because a hover callout is what declaring `tooltip`
 * buys rather than something every chart shows by default. A chart declaring
 * an empty `tooltip` still gets one, falling back to the engine's own
 * `label: value` text.
 *
 * Declared structurally, mirroring `ChartAxisDisplay` in `chart-series-shared`,
 * so the canvas never has to import from `chart-canvas.tsx` — which imports the
 * canvas.
 */
export interface ChartTooltipDisplay {
  readonly format?: string
}

/**
 * Where the callout for a bar is anchored, in the plot area's own coordinates.
 *
 * Its input comes from {@link ChartValueScale.toY}, the same projection the bar
 * rect is drawn with, so the callout tracks the bar under a logarithmic axis as
 * faithfully as under a linear one.
 *
 * {@link ChartTooltip} draws itself ABOVE the point it is given, so anchoring
 * naively on the bar's top edge puts the tallest bar's callout off the top of
 * the SVG — and the tallest bar is not an edge case here: the value scale is
 * built from the data's own maximum, so one bar touches `y = 0` in every bar
 * chart ever drawn. Clamping to the callout's own height keeps it inside the
 * plot; it then overlaps the top of a full-height bar, which is harmless
 * because the callout layer takes no pointer events.
 */
function calloutAnchorY(barY: number): number {
  return Math.max(barY, CHART_TOOLTIP_HEIGHT + CHART_TOOLTIP_POINT_GAP)
}

/**
 * One bar, hoverable when the chart declared a tooltip.
 *
 * The handlers are memoised and then read through a local binding rather than
 * built in the JSX, because an inline closure in a prop re-allocates on every
 * render (the react-perf eco rules forbid it).
 */
function HoverBar({
  datum,
  x,
  width,
  barY,
  innerHeight,
  format,
  onHover,
}: {
  readonly datum: CategoryDatum
  readonly x: number
  readonly width: number
  readonly barY: number
  readonly innerHeight: number
  readonly format: string | undefined
  readonly onHover: ((state: TooltipState | undefined) => void) | undefined
}): ReactElement {
  const { key, value } = datum
  const handleEnter = useCallback(() => {
    onHover?.({ x: x + width / 2, y: calloutAnchorY(barY), label: key, value, format })
  }, [onHover, x, width, barY, key, value, format])
  const handleLeave = useCallback(() => onHover?.(undefined), [onHover])
  const enter = onHover ? handleEnter : undefined
  const leave = onHover ? handleLeave : undefined
  return (
    <Bar
      x={x}
      y={barY}
      width={width}
      height={innerHeight - barY}
      fill={PRIMARY_SERIES_PAINT}
      rx={CHART_BAR_RADIUS}
      data-bar-key={key}
      onMouseEnter={enter}
      onMouseLeave={leave}
    />
  )
}

/**
 * The chart's bars, and — when the chart declared a `tooltip` — the callout
 * that reads the bar under the cursor through the author's template.
 *
 * The callout is emitted as a SIBLING of the bar group rather than around it,
 * so the rendered shape of a chart that declares no tooltip is exactly what it
 * was before the layer existed.
 */
export function BarPlot({
  data,
  xScale,
  yScale,
  innerHeight,
  tooltip,
}: {
  readonly data: readonly CategoryDatum[]
  readonly xScale: BandScale
  readonly yScale: ChartValueScale
  readonly innerHeight: number
  readonly tooltip: ChartTooltipDisplay | undefined
}): ReactElement {
  const [hovered, setHovered] = useState<TooltipState | undefined>(undefined)
  const bandwidth = xScale.bandwidth()
  const onHover = tooltip ? setHovered : undefined
  return (
    <>
      <g>
        {data.map((d) => (
          <HoverBar
            key={`bar-${d.key}`}
            datum={d}
            x={xScale(d.key) ?? 0}
            width={bandwidth}
            barY={yScale.toY(d.value)}
            innerHeight={innerHeight}
            format={tooltip?.format}
            onHover={onHover}
          />
        ))}
      </g>
      {tooltip ? <ChartTooltip state={hovered} /> : undefined}
    </>
  )
}
