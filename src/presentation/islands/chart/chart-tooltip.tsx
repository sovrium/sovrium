/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

export interface TooltipState {
  readonly x: number
  readonly y: number
  readonly label: string
  readonly value: number
  readonly format?: string
}

function formatTooltipText(state: TooltipState): string {
  const value = String(state.value)
  if (state.format) {
    return state.format.replaceAll('{label}', state.label).replaceAll('{value}', value)
  }
  return `${state.label}: ${value}`
}

function tooltipWidth(text: string): number {
  return Math.max(40, text.length * 6.5 + 12)
}

export function ChartTooltip({
  state,
}: {
  readonly state: TooltipState | undefined
}): ReactElement | undefined {
  if (!state) return undefined
  const text = formatTooltipText(state)
  const w = tooltipWidth(text)
  const h = 22
  return (
    <g
      className="chart-tooltip"
      data-chart-tooltip="true"
      role="tooltip"
      pointerEvents="none"
    >
      <rect
        x={state.x - w / 2}
        y={state.y - h - 8}
        width={w}
        height={h}
        rx={3}
        fill="var(--color-fg)"
      />
      <text
        x={state.x}
        y={state.y - h / 2 - 8}
        fontSize={11}
        fill="var(--color-bg)"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {text}
      </text>
    </g>
  )
}
