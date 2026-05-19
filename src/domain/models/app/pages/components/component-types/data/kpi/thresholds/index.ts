/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const KPIThresholdSchema = Schema.Struct({
  value: Schema.Number.annotations({ description: 'Threshold boundary value' }),
  color: Schema.String.annotations({
    description: 'Color name or hex applied when metric meets this threshold',
  }),
}).annotations({
  title: 'KPI Threshold',
  description:
    'Conditional color threshold — applied when the metric value meets or exceeds the boundary',
})

export type KPIThreshold = Schema.Schema.Type<typeof KPIThresholdSchema>
