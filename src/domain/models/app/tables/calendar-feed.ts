/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/** A field name: a non-empty string, described by the key that holds it. */
const feedFieldName = (description: string) =>
  Schema.String.pipe(Schema.annotate({ description }), Schema.check(Schema.isMinLength(1)))

/**
 * The rows of this table, published as a calendar people subscribe to.
 *
 * Each person who may read the table gets their own feed address
 * (`/api/tables/{table}/calendar-feed/{token}.ics`), which lists the rows THEY may read
 * — row-level rules and field-level read permissions apply, evaluated when the
 * calendar app fetches the feed, not when the address was made. Which fields
 * each key may name, and that they exist on the table, is judged with the other
 * table rules (`validateTableSchema`), because the answer depends on the
 * table's fields.
 *
 * @example
 * ```typescript
 * // A meetings table subscribed from Proton, Google or Apple Calendar.
 * {
 *   name: 'meetings',
 *   fields: [...],
 *   calendarFeed: { start: 'starts_at', end: 'ends_at', title: 'title', description: 'notes' },
 * }
 * ```
 */
export const TableCalendarFeedSchema = Schema.Struct({
  start: feedFieldName(
    'The field an event starts at: a `date` or `datetime` field of this table. A `date` field makes all-day events. A row whose field is empty is left out of the feed.'
  ),
  end: Schema.optional(
    feedFieldName(
      'The field an event ends at, of the same type as `start`. A `date` end is the last day the event covers. Left out, or empty on a row, a `date` event lasts one day and a `datetime` event has no duration.'
    )
  ),
  title: feedFieldName(
    "The field shown as the event's title: a `single-line-text`, `long-text`, `email`, `url`, `phone-number`, `single-select` or `status` field of this table. A person who may not read it sees events without a title."
  ),
  description: Schema.optional(
    feedFieldName(
      "The field shown as the event's notes, of one of the kinds `title` accepts. A person who may not read it sees events without notes."
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'TableCalendarFeed',
    title: 'Calendar Feed',
    description:
      'Publishes the rows of this table as a calendar feed (iCalendar, `.ics`) that Proton, Google or Apple Calendar can subscribe to. Each person who may read the table creates their own private feed address, which lists only the rows and fields they may read, and which they can replace or revoke at any time. Without it, the table has no feed.',
  })
)

/** @public */
export type TableCalendarFeed = Schema.Schema.Type<typeof TableCalendarFeedSchema>
