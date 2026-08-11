/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AggregateFunctionSchema } from '../../../shared-schemas'

/**
 * Aggregate function for KPI metric computation.
 *
 * Alias of the shared `AggregateFunctionSchema` with a KPI-specific
 * description annotation.
 */
export const KPIAggregateFunctionSchema = AggregateFunctionSchema.annotations({
  title: 'KPI Aggregate Function',
  description: 'Aggregate function applied to compute the KPI metric value',
})

export const KPIAggregateSchema = Schema.Struct({
  function: KPIAggregateFunctionSchema,
  field: Schema.optional(
    Schema.String.annotations({ description: 'Field to aggregate (omit for count)' })
  ),
}).annotations({
  title: 'KPI Aggregate',
  description: 'Aggregate function configuration for KPI metric computation',
})

/** @public */
export type KPIAggregateFunction = Schema.Schema.Type<typeof KPIAggregateFunctionSchema>
/** @public */
export type KPIAggregate = Schema.Schema.Type<typeof KPIAggregateSchema>
