/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ChartCategoryOption } from './chart-aggregate'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'

/** Every mark `ChartTypeSchema` accepts. */
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'donut' | 'scatter'

export interface ChartAxisConfig {
  readonly field: string
  readonly label?: string
  readonly format?: 'date' | 'currency' | 'number' | 'percent'
  readonly scale?: 'linear' | 'logarithmic'
  readonly gridLines?: boolean
}

export interface ChartLegendConfig {
  readonly position?: 'top' | 'bottom' | 'left' | 'right' | 'none'
  readonly visible?: boolean
}

export interface ChartTooltipConfig {
  readonly format?: string
}

/**
 * What the server resolved about the fields a chart names, from `app.tables`:
 * the grouping field's declared options (in declared order, with their labels
 * and colours) and the plotted field's currency display. The island receives
 * records only, never the field schema, so this is how a category keeps its
 * option's place and colour and a currency axis its field's currency.
 */
export interface ChartFieldContext {
  readonly categoryOptions?: readonly ChartCategoryOption[]
  readonly valueCurrency?: CurrencyDisplayOptions
  /** `dataLabels` — `false` leaves a pie or donut's slice names off its ring. */
  readonly dataLabels?: boolean
}
