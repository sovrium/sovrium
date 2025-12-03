/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Date Field
 *
 * Stores date and optionally time values.
 * Supports custom date formats, timezone configuration, and time inclusion.
 * Can be marked as required, unique, or indexed for efficient date-based queries.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'due_date',
 *   type: 'date',
 *   required: true,
 *   format: 'YYYY-MM-DD',
 *   includeTime: false
 * }
 * ```
 */
export const DateFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('date', 'datetime', 'time'),
      format: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Date format string',
            examples: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD-MM-YYYY'],
          })
        )
      ),
      dateFormat: Schema.optional(
        Schema.Literal('US', 'European', 'ISO').pipe(
          Schema.annotations({
            description: 'Date display format preset',
            examples: ['US', 'European', 'ISO'],
          })
        )
      ),
      timeFormat: Schema.optional(
        Schema.Literal('12-hour', '24-hour').pipe(
          Schema.annotations({
            description: 'Time display format (12-hour with AM/PM or 24-hour)',
            examples: ['12-hour', '24-hour'],
          })
        )
      ),
      includeTime: Schema.optional(Schema.Boolean),
      timezone: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Timezone for datetime fields',
            examples: ['UTC', 'America/New_York', 'Europe/London'],
          })
        )
      ),
      timeZone: Schema.optional(
        Schema.Union(Schema.Literal('local'), Schema.String).pipe(
          Schema.annotations({
            description: 'Timezone setting (specific timezone or "local" for browser timezone)',
            examples: ['local', 'America/New_York', 'Europe/Paris'],
          })
        )
      ),
      default: Schema.optional(Schema.String),
    })
  )
).pipe(
  Schema.annotations({
    title: 'Date Field',
    description:
      'Stores date and optionally time values. Supports custom formats, timezones, and time inclusion.',
    examples: [
      {
        id: 1,
        name: 'due_date',
        type: 'date',
        required: true,
        format: 'YYYY-MM-DD',
        includeTime: false,
      },
    ],
  })
)

export type DateField = Schema.Schema.Type<typeof DateFieldSchema>
