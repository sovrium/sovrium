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
          description: 'DateTime format string for display',
          examples: ['YYYY-MM-DD HH:mm', 'MM/DD/YYYY hh:mm A'],
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
          description: 'Timezone setting (specific timezone or "local" for browser timezone)',
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
