/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  CHART_TOOLTIP_CHAR_WIDTH,
  CHART_TOOLTIP_FILL,
  CHART_TOOLTIP_FONT_SIZE,
  CHART_TOOLTIP_HEIGHT,
  CHART_TOOLTIP_MIN_WIDTH,
  CHART_TOOLTIP_POINT_GAP,
  CHART_TOOLTIP_RADIUS,
  CHART_TOOLTIP_STROKE,
  CHART_TOOLTIP_TEXT_BASELINE_Y,
  CHART_TOOLTIP_TEXT_FILL,
  CHART_TOOLTIP_TEXT_INSET_X,
} from '@/presentation/design/chart-default-classes'
import type { ReactElement } from 'react'

/** Active hover state — the data point currently under the cursor. */
export interface TooltipState {
  readonly x: number
  readonly y: number
  readonly label: string
  readonly value: number
  readonly format?: string
}

/**
 * Applies the chart's `tooltip.format` template, substituting `{label}` and
 * `{value}` placeholders. With no template, falls back to `label: value`.
 */
function formatTooltipText(state: TooltipState): string {
  const value = String(state.value)
  if (state.format) {
    return state.format.replaceAll('{label}', state.label).replaceAll('{value}', value)
  }
  return `${state.label}: ${value}`
}

/**
 * Approximate pixel width for the tooltip background rect: the text's estimated
 * run plus the same inset on both sides. The per-character estimate is
 * calibrated for {@link CHART_TOOLTIP_FONT_SIZE} and moves with it, which is
 * why it lives in the recipe beside the font size rather than here.
 */
function tooltipWidth(text: string): number {
  return Math.max(
    CHART_TOOLTIP_MIN_WIDTH,
    text.length * CHART_TOOLTIP_CHAR_WIDTH + CHART_TOOLTIP_TEXT_INSET_X * 2
  )
}

/**
 * In-SVG chart tooltip. Rendered as an SVG `<g class="chart-tooltip">` so it
 * needs no inline-style positioning (positioned via `x`/`y` attributes) and
 * still resolves for spec locators (`[class*="tooltip"]`).
 *
 * Rendered only while a data point is hovered.
 */
export function ChartTooltip({
  state,
}: {
  readonly state: TooltipState | undefined
}): ReactElement | undefined {
  if (!state) return undefined
  const text = formatTooltipText(state)
  const w = tooltipWidth(text)
  // The rect is CENTRED on the hovered point; the text is then start-anchored
  // from the rect's own left edge, exactly as the canvas draws it.
  const rectX = state.x - w / 2
  const rectY = state.y - CHART_TOOLTIP_HEIGHT - CHART_TOOLTIP_POINT_GAP
  return (
    <g
      className="chart-tooltip"
      data-chart-tooltip="true"
      role="tooltip"
      pointerEvents="none"
    >
      <rect
        x={rectX}
        y={rectY}
        width={w}
        height={CHART_TOOLTIP_HEIGHT}
        rx={CHART_TOOLTIP_RADIUS}
        fill={CHART_TOOLTIP_FILL}
        stroke={CHART_TOOLTIP_STROKE}
      />
      <text
        x={rectX + CHART_TOOLTIP_TEXT_INSET_X}
        y={rectY + CHART_TOOLTIP_TEXT_BASELINE_Y}
        fontSize={CHART_TOOLTIP_FONT_SIZE}
        fill={CHART_TOOLTIP_TEXT_FILL}
      >
        {text}
      </text>
    </g>
  )
}
