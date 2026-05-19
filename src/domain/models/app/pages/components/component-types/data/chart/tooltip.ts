/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ChartTooltipSchema = Schema.Struct({
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

export type ChartTooltip = Schema.Schema.Type<typeof ChartTooltipSchema>
