/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

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
  Schema.fieldsAssign({
    type: Schema.Literal('date').pipe(
      Schema.annotate({
        description: "Constant value 'date' for type discrimination in discriminated unions",
      })
    ),
    format: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'Date format string',
          examples: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD-MM-YYYY'],
        })
      )
    ),
    dateFormat: Schema.optional(
      Schema.Literals(['US', 'European', 'ISO']).pipe(
        Schema.annotate({
          description: 'Date display format preset',
          examples: ['US', 'European', 'ISO'],
        })
      )
    ),
    timeFormat: Schema.optional(
      Schema.Literals(['12-hour', '24-hour']).pipe(
        Schema.annotate({
          description: 'Time display format (12-hour with AM/PM or 24-hour)',
          examples: ['12-hour', '24-hour'],
        })
      )
    ),
    includeTime: Schema.optional(
      Schema.Boolean.annotate({
        description: 'Stores a time alongside the date and offers a time picker when editing.',
      })
    ),
    timezone: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'Timezone for datetime fields',
          examples: ['UTC', 'America/New_York', 'Europe/London'],
        })
      )
    ),
    timeZone: Schema.optional(
      Schema.Union([Schema.Literal('local'), Schema.String]).pipe(
        Schema.annotate({
          description: 'Timezone setting (specific timezone or "local" for browser timezone)',
          examples: ['local', 'America/New_York', 'Europe/Paris'],
        })
      )
    ),
    default: Schema.optional(
      Schema.String.annotate({
        description: 'Date a new record starts on, written the way the field is formatted.',
      })
    ),
  }),
  Schema.annotate({
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
