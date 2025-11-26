/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Rating Field
 *
 * Allows users to assign a rating value (e.g., 1-5 stars, 1-10 points).
 * Supports configurable maximum rating value and visual style.
 * Typically rendered as stars, hearts, or other rating indicators in the UI.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'product_rating',
 *   type: 'rating',
 *   max: 5,
 *   style: 'stars'
 * }
 * ```
 */
export const RatingFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('rating'),
      max: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(1),
          Schema.lessThanOrEqualTo(10),
          Schema.annotations({
            description: 'Maximum rating value',
          })
        )
      ),
      style: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Visual style for the rating',
          })
        )
      ),
      default: Schema.optional(
        Schema.Int.pipe(
          Schema.annotations({
            description: 'Default rating value when creating new records',
          })
        )
      ),
    })
  )
).pipe(
  Schema.annotations({
    title: 'Rating Field',
    description:
      'Allows rating values with configurable maximum. Typically rendered as stars or other indicators.',
    examples: [
      {
        id: 1,
        name: 'product_rating',
        type: 'rating',
        max: 5,
        style: 'stars',
      },
    ],
  })
)

export type RatingField = Schema.Schema.Type<typeof RatingFieldSchema>
