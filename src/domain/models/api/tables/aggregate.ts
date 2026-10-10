/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Wire contract of the aggregate sub-resource — `GET /api/tables/:tableId/aggregate`.
 *
 * Its query takes the list endpoint's `filter` and `aggregate` grammar (so it
 * reuses that file's `queryString`), and its groups are the list response's
 * groups (so it reuses `aggregationsSchema` and `recordGroupSchema`): one
 * shape per concept across the two reads.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { queryString } from './params'
import { aggregationsSchema, recordGroupSchema } from './tables'

/**
 * Aggregate read query parameters — `GET /api/tables/:tableId/aggregate`.
 *
 * `filter`, `q` and `aggregate` take exactly the grammar the list endpoint
 * takes, so a KPI moves from a list read to an aggregate read without
 * re-spelling its binding. There is no `page`, `limit`, `sort` or `fields`: the read returns
 * figures, never rows.
 */
export const aggregateRecordsQuerySchema = Schema.Struct({
  filter: queryString('Filter expression, in the grammar the list endpoint takes'),
  q: queryString(
    'Search term, matched as the list endpoint matches it: across the text fields the caller may read, combined with the filter. Blank means no search'
  ),
  aggregate: queryString(
    'Aggregations to compute over every matching record, in the grammar the list endpoint takes (`amount:sum,amount:avg` or the JSON form). The functions are count, sum, avg, min, max and the percentiles p50, p75, p90, p95 and p99 (`duration_ms:p95`), each interpolated between the two nearest values. Omitted, the read answers the count alone'
  ),
  groupBy: queryString(
    'A field to group the matching records by. Permission-checked like the list endpoint: a field the caller may not read answers 404'
  ),
  interval: optionalField(
    Schema.Literals(['minute', 'hour', 'day', 'week', 'month', 'quarter', 'year']).annotate({
      description:
        'With a date or datetime groupBy field, groups by UTC bucket instead of by exact value. A calendar bucket (day to year) is named by its first day as an ISO date; minute and hour take a datetime field only, and name each group by its first instant as an ISO timestamp',
    })
  ),
  includeDeleted: queryString('Set to "true" to include soft-deleted records'),
  numerator: queryString(
    'With denominator, asks for a ratio: a filter expression, in the grammar the list endpoint takes, that a record matching `filter` must also meet to be counted above the line. Sent without denominator, the read answers 400'
  ),
  denominator: queryString(
    'With numerator, asks for a ratio: a filter expression, in the grammar the list endpoint takes, that a record matching `filter` must also meet to be counted below the line. Sent without numerator, the read answers 400'
  ),
})

/**
 * The most groups one aggregate read answers.
 *
 * A grouping that would produce more is refused with a `400` rather than cut
 * short: a chart silently missing its 501st category reads as a true chart,
 * and a cap the caller cannot see is a wrong answer, not a bounded one.
 */
export const MAX_AGGREGATE_GROUPS = 500

/**
 * A ratio's answer — the two counts, both computed by the same read, and their
 * quotient as a percentage.
 *
 * `percent` is `null` when nothing matches the denominator: a share of nothing
 * is undefined, and answering `0` would read as "none of them" on a dashboard.
 */
const aggregateRatioSchema = Schema.Struct({
  numerator: Schema.Finite.annotate({
    description: 'How many records match both filter and numerator',
  }),
  denominator: Schema.Finite.annotate({
    description: 'How many records match both filter and denominator',
  }),
  percent: Schema.NullOr(Schema.Finite).annotate({
    description: 'numerator ÷ denominator × 100; null when the denominator is 0',
  }),
}).annotate({ description: 'The two counts of a ratio and their quotient as a percentage' })

/**
 * Aggregate read response — `GET /api/tables/:tableId/aggregate`.
 *
 * The figure a KPI or a chart draws, computed by the database over EVERY row
 * the filter matches, and nothing else: no `records`, no `pagination`. A KPI
 * that summed the first page of a list was wrong past that page and spent a
 * whole records read on one number; this read costs a bounded number of
 * statements whatever the table holds.
 *
 * `aggregations` is always present — with no `aggregate` parameter it carries
 * `count` alone. `groups` is present exactly when `groupBy` was sent: one entry
 * per group, or per interval bucket when `interval` was sent (named by the
 * bucket's first day as an ISO date, or by its first instant for `hour` and
 * `minute`), at most {@link MAX_AGGREGATE_GROUPS}: a minute series is read
 * over a bounded window, never cut short.
 * `ratio` is present exactly when `numerator` and `denominator` were sent.
 */
export const aggregateRecordsResponseSchema = Schema.Struct({
  aggregations: aggregationsSchema,
  ratio: optionalField(aggregateRatioSchema),
  groups: optionalField(
    Schema.Array(recordGroupSchema).annotate({
      description: `One entry per group when groupBy is provided, at most ${String(MAX_AGGREGATE_GROUPS)}`,
    })
  ),
})
