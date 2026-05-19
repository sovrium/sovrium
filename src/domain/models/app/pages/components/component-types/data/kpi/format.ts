/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const KPIFormatTypeSchema = Schema.Literal(
  'number',
  'currency',
  'percentage',
  'compact'
).annotations({
  title: 'KPI Format Type',
  description: 'Display format for the KPI metric value',
})

export const KPIFormatSchema = Schema.Struct({
  type: KPIFormatTypeSchema,
  options: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }).annotations({
      description: 'Additional format options (e.g., { currency: "USD" })',
    })
  ),
}).annotations({
  title: 'KPI Format',
  description: 'Display formatting configuration for the KPI metric value',
})

export type KPIFormatType = Schema.Schema.Type<typeof KPIFormatTypeSchema>
export type KPIFormat = Schema.Schema.Type<typeof KPIFormatSchema>
