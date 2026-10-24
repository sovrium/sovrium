/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConditionGroupSchema } from '../../conditions'
import { ActionBaseFields } from '../base'

/**
 * The figures `record/aggregate` computes — the records API's own aggregate
 * vocabulary (`GET /api/tables/:table/aggregate`): the five plain figures and
 * the five continuous percentiles, nothing an automation could ask for that the
 * API cannot answer.
 */
export const RECORD_AGGREGATE_OPS = [
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'p50',
  'p75',
  'p90',
  'p95',
  'p99',
] as const

/** One figure: which field, which operation. */
const RecordAggregationSchema = Schema.Struct({
  field: Schema.String.pipe(
    Schema.annotate({
      description:
        'The field the figure is computed over. For `count`, the field only names the figure: it counts the records.',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  op: Schema.Literals(RECORD_AGGREGATE_OPS).pipe(
    Schema.annotate({
      description:
        'The figure: `count`, `sum`, `avg`, `min`, `max`, or a continuous percentile `p50`, `p75`, `p90`, `p95`, `p99` (interpolated, as a spreadsheet PERCENTILE.INC). Over no values a figure is null, never 0.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'RecordAggregation',
    title: 'Record Aggregation',
    description: 'One figure of a record/aggregate step: a field and the operation over it',
  })
)

/**
 * Record Aggregate Action (type: record, operator: aggregate)
 *
 * The figure-shaped read: count, sum, average, extremes and percentiles over
 * the records a filter matches, optionally one row per value of a field,
 * computed BY THE DATABASE in one statement — the same computation the records
 * API's aggregate read runs. A code step that pulls rows into JavaScript to
 * sort them for a percentile does on the event loop what one SQL statement
 * does in the database; this is that statement.
 *
 * It reads as `record/list` reads: the same `filter` grammar, the same reader
 * (the app for a triggered run, the person for a run started by hand), the
 * same masks on lookups. A figure only ever describes rows that reader could
 * list.
 *
 * Output: `{ rows }` — one row without `groupBy`, one row per group with it.
 * Each row holds `count` (its records), the group's value under the `groupBy`
 * field's name, and each figure under `<field>_<op>` (`duration_ms_p95`).
 * A grouping past the records API's group cap fails the step rather than
 * answering a truncated list: a rollup missing its 501st route reads as true.
 */
export const RecordAggregateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record').pipe(
    Schema.annotate({
      description: "Constant value 'record' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('aggregate').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'record' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    table: Schema.String.pipe(
      Schema.annotate({ description: 'Table whose records the figures describe' }),
      Schema.check(Schema.isMinLength(1))
    ),
    /** Which records count, as record/list reads them. Omitted means every non-deleted record. */
    filter: Schema.optional(ConditionGroupSchema),
    aggregations: Schema.Array(RecordAggregationSchema).pipe(
      Schema.annotate({
        description:
          'The figures to compute, each `{ field, op }`. Each lands in every row as `<field>_<op>`; every row also carries `count`.',
      }),
      Schema.check(Schema.isMinLength(1))
    ),
    groupBy: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            "A field to group by: one row per value of it, the value under the field's name. A grouping with more groups than the records API's aggregate read allows fails the step.",
        }),
        Schema.check(Schema.isMinLength(1))
      )
    ),
  }).annotate({
    description:
      'The table to read, which records count, the figures to compute, and the field to group them by.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'RecordAggregateAction',
    title: 'Record Aggregate Action',
    description:
      'Compute count, sum, average, minimum, maximum and percentiles over the records a filter matches, optionally per group, in one database statement; returned as `rows`',
    howTo:
      "Roll up response times per route: `table: transactions`, a `filter` on the last 24 hours, `groupBy: name` and `aggregations: [{ field: duration_ms, op: p95 }]`, then loop over '{{steps.rollup.rows}}' and read `duration_ms_p95` and `count` on each row.",
  })
)

/** @public */
export type RecordAggregateAction = Schema.Schema.Type<typeof RecordAggregateActionSchema>
