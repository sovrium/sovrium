/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

interface KpiSparklineProps {
  readonly series: readonly number[]
}

const VIEWBOX_WIDTH = 100
const VIEWBOX_HEIGHT = 28

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
      const y = VIEWBOX_HEIGHT - ((value - min) / span) * VIEWBOX_HEIGHT
      return `${String(Math.round(x * 100) / 100)},${String(Math.round(y * 100) / 100)}`
    })
    .join(' ')
}

export function KpiSparkline({ series }: KpiSparklineProps): ReactElement {
  const points = buildPoints(series)

  return (
    <div
      data-role="sparkline"
      className="mt-2 w-full"
    >
      <svg
        viewBox={`0 0 ${String(VIEWBOX_WIDTH)} ${String(VIEWBOX_HEIGHT)}`}
        preserveAspectRatio="none"
        className="h-8 w-full"
        aria-hidden="true"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-blue-500"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
