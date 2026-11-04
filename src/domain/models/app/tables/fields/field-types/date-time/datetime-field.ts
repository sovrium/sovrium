/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * DateTime Field
 *
 * Stores timezone-aware timestamps (PostgreSQL TIMESTAMPTZ).
 * Used for event times, deadlines, and appointments.
 * Returns ISO 8601 format in API responses.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'starts_at',
 *   type: 'datetime',
 *   required: true,
 *   indexed: true,
 *   timezone: 'UTC'
 * }
 * ```
 */
export const DateTimeFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('datetime').pipe(
      Schema.annotate({
        description: "Constant value 'datetime' for type discrimination in discriminated unions",
      })
    ),
    format: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            "A pattern the value is printed with wherever it is shown, in the page language and at the field's timeZone: yyyy, MM, MMM, MMMM, dd, d, HH, mm, ss, EEE, EEEE, and 'quoted' text. It wins over dateFormat and timeFormat. A pattern naming any other letter is refused when the app starts.",
          examples: ['d MMMM yyyy, HH:mm', 'yyyy-MM-dd HH:mm', "HH'h'mm"],
        })
      )
    ),
    dateFormat: Schema.optional(
      Schema.Literals(['US', 'European', 'ISO']).pipe(
        Schema.annotate({
          description:
            'Writes the date as numbers wherever the value is shown: US 11/20/2026, European 20/11/2026, ISO 2026-11-20.',
          examples: ['US', 'European', 'ISO'],
        })
      )
    ),
    weekday: Schema.optional(
      Schema.Literals(['short', 'long']).annotate({
        description:
          'Prints the day of the week before the date wherever the value is shown: `short` reads "Thu 24 Sep 2026", `long` reads "Thursday 24 September 2026", in the page language.',
        examples: ['short', 'long'],
      })
    ),
    timeFormat: Schema.optional(
      Schema.Literals(['12-hour', '24-hour']).pipe(
        Schema.annotate({
          description:
            'The clock the time is shown on wherever the value is shown, including a time-only reading: 12-hour (1:00 PM) or 24-hour (13:00).',
          examples: ['12-hour', '24-hour'],
        })
      )
    ),
    timezone: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'Timezone for datetime values',
          examples: ['UTC', 'America/New_York', 'Europe/London'],
        })
      )
    ),
    timeZone: Schema.optional(
      Schema.Union([Schema.Literal('local'), Schema.String]).pipe(
        Schema.annotate({
          description:
            "The zone the value is shown in: an IANA zone such as Europe/Paris, or local for each reader's own zone (drawn by the browser).",
          examples: ['local', 'America/New_York', 'Europe/Paris'],
        })
      )
    ),
    default: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'Default datetime value in ISO 8601 format',
          examples: ['2025-01-01T00:00:00Z', 'now'],
        })
      )
    ),
  }),
  Schema.annotate({
    title: 'DateTime Field',
    description:
      'Stores timezone-aware timestamps. Used for event times, deadlines, and appointments with ISO 8601 format.',
    examples: [
      {
        id: 1,
        name: 'starts_at',
        type: 'datetime',
        required: true,
        indexed: true,
        timezone: 'UTC',
      },
    ],
  })
)

export type DateTimeField = Schema.Schema.Type<typeof DateTimeFieldSchema>
