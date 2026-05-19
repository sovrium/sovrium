/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optStr } from '../../../../shared-schemas'

export const ChartSeriesSchema = Schema.Struct({
  field: Schema.String.annotations({
    description: 'Table field name for series data',
  }),
  label: optStr('Display name for the series'),
  color: Schema.optional(
    Schema.String.annotations({
      description: 'Series color — theme token name or hex value (e.g. #3b82f6)',
    })
  ),
  stack: Schema.optional(
    Schema.String.annotations({ description: 'Stack group name for stacked bar/area charts' })
  ),
  fillOpacity: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(1),
      Schema.annotations({ description: 'Area fill opacity between 0 and 1' })
    )
  ),
}).annotations({
  title: 'Chart Series',
  description: 'Single data series configuration',
})

export type ChartSeries = Schema.Schema.Type<typeof ChartSeriesSchema>
