/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  KPI_SPARKLINE_STROKE,
  KPI_SPARKLINE_STROKE_WIDTH,
  computeKpiSparklineClasses,
} from '@/presentation/design/kpi-default-classes'
import type { ReactElement } from 'react'

interface KpiSparklineProps {
  readonly series: readonly number[]
}

const VIEWBOX_WIDTH = 100
const VIEWBOX_HEIGHT = 28

/**
 * Half the stroke, kept inside the box at both extremes.
 *
 * A polyline is stroked CENTRED on its path, so a series normalised across the
 * FULL viewBox height puts its peak on y = 0 and its trough on y = 28 — and
 * half the stroke of each then falls outside the box, where the `<svg>`'s
 * `overflow: hidden` cuts it off. Every peak and every trough drew flat.
 *
 * So the plot area is the box minus half a stroke at the top and half at the
 * bottom. The horizontal extremes need no such inset: the first and last
 * vertices sit on x = 0 and x = 100 with `stroke-linecap: round`, but the line
 * is nearly horizontal there, so what overflows is the cap rather than the
 * line — and insetting x would visibly shorten the series instead.
 */
const PLOT_INSET = KPI_SPARKLINE_STROKE_WIDTH / 2
const PLOT_HEIGHT = VIEWBOX_HEIGHT - PLOT_INSET * 2

/**
 * Builds the SVG polyline points for a sparkline series.
 *
 * The series is normalized into the fixed viewBox so the mini-chart scales
 * regardless of the underlying value magnitude.
 */
function buildPoints(series: readonly number[]): string {
  if (series.length === 0) return ''
  if (series.length === 1) {
    const y = VIEWBOX_HEIGHT / 2
    return `0,${String(y)} ${String(VIEWBOX_WIDTH)},${String(y)}`
  }

  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min || 1
  const step = VIEWBOX_WIDTH / (series.length - 1)

  return series
    .map((value, index) => {
      const x = index * step
      // Invert Y so larger values sit higher in the chart, and keep both
      // extremes half a stroke inside the box — see {@link PLOT_INSET}.
      const y = VIEWBOX_HEIGHT - PLOT_INSET - ((value - min) / span) * PLOT_HEIGHT
      return `${String(Math.round(x * 100) / 100)},${String(Math.round(y * 100) / 100)}`
    })
    .join(' ')
}

/**
 * Renders the KPI sparkline as an inline SVG mini line chart.
 *
 * Carries `data-role="sparkline"` so spec assertions resolve, and emits a
 * single `<polyline>` for the trend line.
 */
export function KpiSparkline({ series }: KpiSparklineProps): ReactElement {
  const points = buildPoints(series)

  return (
    <div
      data-role="sparkline"
      className={computeKpiSparklineClasses()}
    >
      <svg
        viewBox={`0 0 ${String(VIEWBOX_WIDTH)} ${String(VIEWBOX_HEIGHT)}`}
        preserveAspectRatio="none"
        className={computeKpiSparklineClasses({ part: 'svg' })}
        aria-hidden="true"
      >
        {/* The box is painted ~541px wide from 100 user units against a 1x
            vertical scale, so a stroke that scales with the geometry paints
            ~8px thick on a horizontal run and 1.5px on a vertical one — the
            weight of the line changes with its own slope. `non-scaling-stroke`
            keeps the path stretching and stops the stroke. */}
        <polyline
          points={points}
          fill="none"
          stroke={KPI_SPARKLINE_STROKE}
          strokeWidth={KPI_SPARKLINE_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}
