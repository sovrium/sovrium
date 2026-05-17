/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * Time Field
 *
 * Stores time-only values without a date component (PostgreSQL TIME).
 * Used for schedules, opening hours, and time slots.
 * Returns HH:MM:SS format in API responses.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'start_time',
 *   type: 'time',
 *   required: true,
 *   timeFormat: '24-hour'
 * }
 * ```
 */
export const TimeFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('time'),
      timeFormat: Schema.optional(
        Schema.Literal('12-hour', '24-hour').pipe(
          Schema.annotations({
            description: 'Time display format (12-hour with AM/PM or 24-hour)',
            examples: ['12-hour', '24-hour'],
          })
        )
      ),
      default: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Default time value in HH:MM:SS format',
            examples: ['09:00:00', '17:30:00', '00:00:00'],
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Time Field',
    description:
      'Stores time-only values without a date component. Used for schedules, opening hours, and time slots.',
    examples: [
      {
        id: 1,
        name: 'start_time',
        type: 'time',
        required: true,
        timeFormat: '24-hour',
      },
    ],
  })
)

export type TimeField = Schema.Schema.Type<typeof TimeFieldSchema>
