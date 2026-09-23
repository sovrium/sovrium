/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * Duration Field
 *
 * Stores time duration values (e.g., hours, minutes, seconds).
 * Used for tracking elapsed time, work hours, or time intervals.
 * Supports custom display formats for presenting duration values.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'work_hours',
 *   type: 'duration',
 *   required: true,
 *   format: 'h:mm'
 * }
 * ```
 */
export const DurationFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('duration').pipe(
      Schema.annotate({
        description: "Constant value 'duration' for type discrimination in discriminated unions",
      })
    ),
    format: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'Display format for the duration',
        })
      )
    ),
    displayFormat: Schema.optional(
      Schema.Literals(['h:mm', 'h:mm:ss', 'decimal']).pipe(
        Schema.annotate({
          description: 'Display format preset for duration values',
          examples: ['h:mm', 'h:mm:ss', 'decimal'],
        })
      )
    ),
    default: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Default duration value in seconds when creating new records',
        })
      )
    ),
  }),
  Schema.annotate({
    title: 'Duration Field',
    description:
      'Stores time duration values. Used for tracking elapsed time or work hours with custom formats.',
    examples: [
      {
        id: 1,
        name: 'work_hours',
        type: 'duration',
        required: true,
        format: 'h:mm',
      },
    ],
  })
)

export type DurationField = Schema.Schema.Type<typeof DurationFieldSchema>
