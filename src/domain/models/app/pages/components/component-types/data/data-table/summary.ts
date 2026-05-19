/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AggregateFunctionSchema, optStr } from '../../../shared-schemas'

export const SummaryFunctionSchema = AggregateFunctionSchema.annotations({
  title: 'Summary Function',
  description: 'Aggregate function for summary computation',
})

export const DataTableSummaryItemSchema = Schema.Struct({
  field: Schema.String.annotations({ description: 'Field name to compute summary on' }),
  function: SummaryFunctionSchema,
  label: optStr('Summary display label'),
}).annotations({
  title: 'Summary Item',
  description: 'Single aggregate computation for the summary row',
})

export type SummaryFunction = Schema.Schema.Type<typeof SummaryFunctionSchema>
export type DataTableSummaryItem = Schema.Schema.Type<typeof DataTableSummaryItemSchema>
