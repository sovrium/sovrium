/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Progress Field
 *
 * Displays a percentage value as a progress bar.
 * Used for tracking completion status, goals, or percentages.
 * Supports optional color customization for the progress bar.
 * Values are typically stored as numbers between 0 and 100.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'task_completion',
 *   type: 'progress',
 *   required: true,
 *   color: '#10B981'
 * }
 * ```
 */
export const ProgressFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('progress'),
      color: Schema.optional(
        Schema.String.pipe(
          Schema.pattern(/^#[0-9a-fA-F]{6}$/, {
            message: () => 'Color of the progress bar',
          }),
          Schema.annotations({
            description: 'Color of the progress bar',
          })
        )
      ),
      default: Schema.optional(
        Schema.Number.pipe(
          Schema.greaterThanOrEqualTo(0),
          Schema.lessThanOrEqualTo(100),
          Schema.annotations({
            description: 'Default progress value (0-100) when creating new records',
          })
        )
      ),
    })
  )
).pipe(
  Schema.annotations({
    title: 'Progress Field',
    description:
      'Displays percentage value as progress bar. Used for tracking completion status or goals.',
    examples: [
      {
        id: 1,
        name: 'task_completion',
        type: 'progress',
        required: true,
        color: '#10B981',
      },
    ],
  })
)

export type ProgressField = Schema.Schema.Type<typeof ProgressFieldSchema>
