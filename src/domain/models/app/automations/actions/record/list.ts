/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConditionGroupSchema } from '../../conditions'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * One ordering key. `field` is templated — so it reaches SQL as an
 * IDENTIFIER exactly as a filter field does, and must pass the same
 * two-layer resolvable-column check (boot-time in `app/index.ts`,
 * run-time in `record-filters.ts`). An unresolvable sort column is worse
 * than the filter tautology: Postgres raises 42703 and fails closed, but
 * SQLite resolves the unknown quoted name to a string LITERAL, so every
 * row sorts by the same constant and the rows come back unordered with a
 * successful run.
 *
 * `direction` is a literal union rather than a template: it is a closed
 * two-value vocabulary, and templating it would require a runtime parse
 * that could only ever fail.
 */
const RecordListSortSchema = Schema.Struct({
  field: TemplateStringSchema.pipe(Schema.annotate({ description: 'Field name to sort by' })),
  direction: Schema.optional(
    Schema.Literals(['asc', 'desc']).pipe(
      Schema.annotate({ description: 'Sort direction (default: asc)' })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'RecordListSort',
    title: 'Record List Sort Key',
    description: 'A single ordering key applied to a record list read',
  })
)

/** @public */
export type RecordListSort = Schema.Schema.Type<typeof RecordListSortSchema>

/**
 * Record List Action (type: record, operator: list)
 *
 * The set-shaped read: which rows (`filter`), in what order (`sort`), how
 * many and from where (`limit` / `offset`), carrying which columns
 * (`fields`). Split out of `record/read` by [internal ref] — `read` is now
 * primary-key-only, because collapsing a filtered set to `records[0]` from
 * an unordered query returned an arbitrary row.
 *
 * Emits the same `{ record, records }` envelope as `read`, so
 * `{{step.record.x}}` and `{{step.records}}` work unchanged.
 *
 * ── Two things a reader will get wrong without reading this ──
 *
 * **`limit` means the OPPOSITE of `limit` on `batchDelete`.** Here it is a
 * page size: it truncates, quietly and by design. On `batchDelete` it is a
 * safety threshold: exceeding it FAILS the run and deletes nothing. The
 * bound (1..10000) is deliberately identical so one number means one thing
 * repo-wide; the behaviour on exceeding it is not. `limit` keeps this name
 * because three of the four shipped `limit`s already mean page size.
 *
 * **`fields` is a payload trim, NOT a permission boundary.** Read
 * permissions are enforced by `filterReadableFields`, which needs a
 * `userRole` an automation run does not have — so that code never executes
 * on this path. An automation that can read a table can read every column
 * of it; `fields` only decides how much of the row is carried into the
 * step payload.
 *
 * Empty `sort: []` and `fields: []` are rejected at decode: both would
 * compile to a no-op while reading as intent.
 *
 * `offset` without `sort` is deliberately ACCEPTED. Determinism comes from
 * an implicit `id ASC` appended as the FINAL ordering key whenever
 * pagination applies — not merely when `sort` is absent, because ties
 * inside a supplied sort skip or duplicate rows across a page boundary
 * just as readily as no sort at all. A TOTAL order is the requirement.
 */
export const RecordListActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record').pipe(
    Schema.annotate({
      description: "Constant value 'record' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('list').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'record' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    table: Schema.String.pipe(
      Schema.annotate({ description: 'Target table name' }),
      Schema.check(Schema.isMinLength(1))
    ),

    /** Which rows. Omitted means every non-deleted row of the table. */
    filter: Schema.optional(ConditionGroupSchema),

    /**
     * Which columns come back in the step payload. A trim, not a
     * permission boundary — see the note above.
     */
    fields: Schema.optional(
      Schema.Array(Schema.String).pipe(
        Schema.annotate({ description: 'Field names to include in the returned records' }),
        Schema.check(Schema.isMinLength(1))
      )
    ),

    /** In what order. Later keys break ties in earlier ones, in array order. */
    sort: Schema.optional(
      Schema.Array(RecordListSortSchema).pipe(
        Schema.annotate({ description: 'Ordering keys, applied in array order' }),
        Schema.check(Schema.isMinLength(1))
      )
    ),

    /** Page size (1-10000). Truncates — contrast `batchDelete`'s safety limit. */
    limit: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({ description: 'Maximum records to return (1-10000, page size)' }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10_000 }))
      )
    ),

    /** How many rows to skip before the page starts. */
    offset: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({ description: 'Number of records to skip before the page' }),
        Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
      )
    ),
  }).annotate({
    description:
      'The table to read, which records to keep, the fields to return, and the order and page.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'RecordListAction',
    title: 'Record List Action',
    description: 'Read a filtered, ordered, paginated set of records from a table',
  })
)

/** @public */
export type RecordListAction = Schema.Schema.Type<typeof RecordListActionSchema>
