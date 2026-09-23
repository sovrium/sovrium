/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

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
  Schema.fieldsAssign({
    type: Schema.Literal('rating').pipe(
      Schema.annotate({
        description: "Constant value 'rating' for type discrimination in discriminated unions",
      })
    ),
    max: Schema.optional(
      Schema.Int.pipe(
        Schema.annotate({
          description: 'Maximum rating value',
        }),
        Schema.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10))
      )
    ),
    style: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'Visual style for the rating',
        })
      )
    ),
    default: Schema.optional(
      Schema.Int.pipe(
        Schema.annotate({
          description: 'Default rating value when creating new records',
        })
      )
    ),
  }),
  Schema.annotate({
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

/** @public */
export type RatingField = Schema.Schema.Type<typeof RatingFieldSchema>
