/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataFilterSchema } from '../../../data-source'
import { AggregateFunctionSchema } from '../../../shared-schemas'

/**
 * Aggregate function for KPI metric computation.
 *
 * The shared `AggregateFunctionSchema` (count, sum, avg, min, max — the chart
 * and the table footer use the same five) widened with `ratio`, which only a
 * KPI draws: a ratio is two counts and a percentage, not a figure a chart axis
 * or a summary cell can hold. That is why `ratio` is added HERE and never to
 * the shared schema.
 */
export const KPIAggregateFunctionSchema = Schema.Union([
  AggregateFunctionSchema,
  Schema.Literal('ratio'),
]).annotate({
  title: 'KPI Aggregate Function',
  description:
    'Aggregate function applied to compute the KPI metric value: count, sum, avg, min, max, or ratio (the share of the records matching numerator.filter among those matching denominator.filter, as a percentage)',
})

/**
 * One side of a ratio: the records of the KPI's data source that also match
 * `filter`.
 */
const KPIRatioSideSchema = Schema.Struct({
  filter: Schema.Array(DataFilterSchema).pipe(
    Schema.annotate({
      description:
        "Conditions, combined with AND, that a record of the KPI's data source must also meet to be counted on this side of the ratio",
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({
  title: 'KPI Ratio Side',
  description: "The records of the KPI's data source counted on one side of a ratio",
})

/** Why a declaration is refused, or `true` when the function and its keys agree. */
const ratioKeysAgree = (aggregate: {
  readonly function: string
  readonly field?: string
  readonly numerator?: unknown
  readonly denominator?: unknown
}): true | string => {
  if (aggregate.function === 'ratio') {
    if (aggregate.numerator === undefined || aggregate.denominator === undefined)
      return 'a ratio needs both numerator and denominator'
    if (aggregate.field !== undefined) return 'a ratio counts records and takes no field'
    return true
  }
  return aggregate.numerator === undefined && aggregate.denominator === undefined
    ? true
    : 'numerator and denominator belong to function: ratio'
}

export const KPIAggregateSchema = Schema.Struct({
  function: KPIAggregateFunctionSchema,
  field: Schema.optional(
    Schema.String.annotate({ description: 'Field to aggregate (omit for count and ratio)' })
  ),
  numerator: Schema.optional(
    KPIRatioSideSchema.annotate({
      description:
        'With function: ratio, the records counted above the line — for a reply rate, the conversations that got a reply',
    })
  ),
  denominator: Schema.optional(
    KPIRatioSideSchema.annotate({
      description:
        'With function: ratio, the records counted below the line — for a reply rate, every conversation',
    })
  ),
})
  .annotate({
    title: 'KPI Aggregate',
    description:
      'Aggregate function configuration for KPI metric computation. A ratio counts the records matching numerator.filter and denominator.filter on the same data source and shows numerator ÷ denominator × 100',
  })
  .check(Schema.makeFilter(ratioKeysAgree))

/** @public */
export type KPIAggregateFunction = Schema.Schema.Type<typeof KPIAggregateFunctionSchema>
/** @public */
export type KPIAggregate = Schema.Schema.Type<typeof KPIAggregateSchema>
