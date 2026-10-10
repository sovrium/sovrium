/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/** The fewest and the most days a retention window may span. */
const MIN_RETENTION_DAYS = 1
const MAX_RETENTION_DAYS = 36_500

/**
 * How long the rows of this table are kept.
 *
 * Once a day a sweep deletes, for good, every row whose `field` is older than
 * `days` days — trashed rows included — in batches, without starting record
 * automations or webhooks. Which field it may name, and that it exists on the
 * table, is judged with the other table rules (`validateTableSchema`), because
 * the answer depends on the table's fields.
 *
 * @example
 * ```typescript
 * // An event log keeps thirty days of events.
 * { name: 'events', fields: [...], retention: { field: 'received_at', days: 30 } }
 * ```
 */
export const TableRetentionSchema = Schema.Struct({
  field: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "The field a row's age is read from: a `date`, `datetime`, `created-at` or `updated-at` field of this table, or the table's own `created_at` or `updated_at`. A row whose field is empty is kept.",
        defaultNote: '`created_at`, the time the row was created',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  days: Schema.Finite.pipe(
    Schema.annotate({
      description:
        'How many days a row is kept, counted in calendar days in the operator timezone: a row is deleted once its field falls before the start of the day this many days ago. A whole number from 1 to 36500.',
    }),
    Schema.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: MIN_RETENTION_DAYS, maximum: MAX_RETENTION_DAYS })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'TableRetention',
    title: 'Retention',
    description:
      'How long the rows of this table are kept. Once a day, rows older than the window are deleted for good, trashed or not, without starting record automations or webhooks. Without it, rows are kept until someone deletes them.',
  })
)

/** @public */
export type TableRetention = Schema.Schema.Type<typeof TableRetentionSchema>
