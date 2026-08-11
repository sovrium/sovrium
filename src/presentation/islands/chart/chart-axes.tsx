/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared SVG axis primitives for the multi-series chart family. The
 * multi-line and multi-area canvases use a `scalePoint` X-axis; the
 * multi-bar canvas uses a `scaleBand` X-axis that needs a half-bandwidth
 * label offset. Both render the same baseline + tick-label structure.
 */

import type { scaleBand, scalePoint } from '@visx/scale'
import type { ReactElement } from 'react'

/** The two axis baselines (vertical Y line + horizontal X line). */
function AxisBaselines({
  innerWidth,
  innerHeight,
}: {
  readonly innerWidth: number
  readonly innerHeight: number
}): ReactElement {
  return (
    <>
      <line
        x1={0}
        x2={0}
        y1={0}
        y2={innerHeight}
        stroke="var(--color-border)"
      />
      <line
        x1={0}
        x2={innerWidth}
        y1={innerHeight}
        y2={innerHeight}
        stroke="var(--color-border)"
      />
    </>
  )
}

/** A single X-axis tick `<text>` label. */
function XTickLabel({
  label,
  x,
  y,
}: {
  readonly label: string
  readonly x: number
  readonly y: number
}): ReactElement {
  return (
    <text
      x={x}
      y={y}
      fontSize={11}
      fill="var(--color-foreground-muted)"
      textAnchor="middle"
    >
      {label}
    </text>
  )
}

/**
 * Axis baselines + X-axis tick labels for a `scalePoint` X-axis (line and
 * area charts). Each key is centred on its point-scale position.
 */
export function PointScaleAxes({
  keys,
  xScale,
  innerWidth,
  innerHeight,
}: {
  readonly keys: readonly string[]
  readonly xScale: ReturnType<typeof scalePoint<string>>
  readonly innerWidth: number
  readonly innerHeight: number
}): ReactElement {
  return (
    <g>
      <AxisBaselines
        innerWidth={innerWidth}
        innerHeight={innerHeight}
      />
      {keys.map((k) => (
        <XTickLabel
          key={`x-label-${k}`}
          label={k}
          x={xScale(k) ?? 0}
          y={innerHeight + 18}
        />
      ))}
    </g>
  )
}

/**
 * Axis baselines + X-axis tick labels for a `scaleBand` X-axis (bar chart).
 * Each key is centred within its band by adding a half-bandwidth offset.
 */
export function BandScaleAxes({
  keys,
  xScale,
  innerWidth,
  innerHeight,
}: {
  readonly keys: readonly string[]
  readonly xScale: ReturnType<typeof scaleBand<string>>
  readonly innerWidth: number
  readonly innerHeight: number
}): ReactElement {
  const bandwidth = xScale.bandwidth()
  return (
    <g>
      <AxisBaselines
        innerWidth={innerWidth}
        innerHeight={innerHeight}
      />
      {keys.map((k) => (
        <XTickLabel
          key={`x-label-${k}`}
          label={k}
          x={(xScale(k) ?? 0) + bandwidth / 2}
          y={innerHeight + 18}
        />
      ))}
    </g>
  )
}
