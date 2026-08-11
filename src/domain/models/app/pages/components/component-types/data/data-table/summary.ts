/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AggregateFunctionSchema, optStr } from '../../../shared-schemas'

/**
 * Aggregate function for data-table summary rows.
 *
 * Alias of the shared `AggregateFunctionSchema` with a summary-specific
 * description annotation.
 */
export const SummaryFunctionSchema = AggregateFunctionSchema.annotations({
  title: 'Summary Function',
  description: 'Aggregate function for summary computation',
})

/**
 * Summary row item -- an aggregate computation on a field.
 *
 * @example
 * ```yaml
 * summary:
 *   - field: total
 *     function: count
 *     label: Total
 *   - field: amount
 *     function: sum
 *     label: Revenue
 * ```
 */
export const DataTableSummaryItemSchema = Schema.Struct({
  /** Field to aggregate */
  field: Schema.String.annotations({ description: 'Field name to compute summary on' }),
  /** Aggregate function */
  function: SummaryFunctionSchema,
  /** Display label for the summary */
  label: optStr('Summary display label'),
}).annotations({
  title: 'Summary Item',
  description: 'Single aggregate computation for the summary row',
})

export type SummaryFunction = Schema.Schema.Type<typeof SummaryFunctionSchema>
export type DataTableSummaryItem = Schema.Schema.Type<typeof DataTableSummaryItemSchema>
