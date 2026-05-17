/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Chart tooltip configuration.
 */
export const ChartTooltipSchema = Schema.Struct({
  /** Tooltip text template with `{label}` and `{value}` placeholders */
  format: Schema.optional(
    Schema.String.annotations({
      description: 'Tooltip text template — supports {label} and {value} placeholders',
      examples: ['{label}: {value}', '{value}'],
    })
  ),
}).annotations({
  title: 'Chart Tooltip',
  description: 'Tooltip display configuration',
})

/** @public */
export type ChartTooltip = Schema.Schema.Type<typeof ChartTooltipSchema>
