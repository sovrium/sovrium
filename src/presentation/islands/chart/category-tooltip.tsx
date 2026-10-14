/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The hover callout of a chart drawn one category per mark — a pie, a donut, a
 * radar's spoke, a radial chart's arc — when a `tooltip` is declared.
 *
 * The same callout every cartesian chart draws (`ChartTooltipContent`), read
 * the same way: the author's `format` line when declared, `{label}` naming the
 * hovered category and `{value}` its value, else the category's name and value
 * as two columns. `indicator` and `hideIndicator` reach the row; there is no
 * heading to hide, the category being the row itself.
 */

import { ChartTooltip, ChartTooltipContent } from '../parts/chart-primitives'
import { formatTooltipText } from './chart-format'
import type { ChartTooltipConfig } from './chart-canvas-types'
import type { ChartTooltipLine } from '../parts/chart-primitives'
import type { ReactElement } from 'react'

/** A category as every one-mark-per-category chart hands it to recharts. */
interface CategoryRow {
  readonly name: string
  readonly value: number
}

/** The callout row of the hovered category. */
const categoryLine =
  (format: string | undefined): ChartTooltipLine =>
  (entry) => {
    const row = entry.payload as CategoryRow | undefined
    if (row === undefined) return undefined
    return format === undefined
      ? { name: row.name, value: row.value.toLocaleString() }
      : { text: formatTooltipText(format, row.name, row.value) }
  }

/** The callout, or nothing when the chart declares no `tooltip`. */
export function categoryTooltip(tooltip: ChartTooltipConfig | undefined): ReactElement | undefined {
  if (tooltip === undefined) return undefined
  return (
    <ChartTooltip
      cursor={false}
      isAnimationActive={false}
      content={
        <ChartTooltipContent
          line={categoryLine(tooltip.format)}
          indicator={tooltip.indicator}
          hideIndicator={tooltip.hideIndicator}
        />
      }
    />
  )
}
