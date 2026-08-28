/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'
import { validateMinMaxRange } from '../validation-utils'

/**
 * Integer Field
 *
 * Numeric field for storing whole numbers without decimal places. Ideal for counts,
 * quantities, IDs, ages, and other discrete numeric values. Supports min/max range
 * validation to enforce business rules. Can be marked as required, unique, or indexed.
 * Stored as database integer type for optimal performance and storage efficiency.
 *
 * Business Rules:
 * - Integers only - no decimal places allowed (enforced at validation level)
 * - Min/max validation optional - useful for enforcing valid ranges (e.g., age >= 0)
 * - Unique constraint useful for custom ID fields or unique numeric identifiers
 * - Indexing recommended for fields used in sorting, filtering, or range queries
 * - Constant value 'integer' ensures type safety and enables discriminated unions
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'quantity',
 *   type: 'integer',
 *   required: true,
 *   min: 0,
 *   max: 1000,
 *   default: 1
 * }
 * ```
 */
export const IntegerFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('integer').pipe(
      Schema.annotate({
        description: "Constant value 'integer' for type discrimination in discriminated unions",
      })
    ),
    min: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Minimum allowed value (inclusive)',
        })
      )
    ),
    max: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Maximum allowed value (inclusive)',
        })
      )
    ),
    default: Schema.optional(
      Schema.Int.pipe(
        Schema.annotate({
          description: 'Default integer value when creating new records',
        })
      )
    ),
  }),
  Schema.check(Schema.makeFilter(validateMinMaxRange)),
  Schema.annotate({
    title: 'Integer Field',
    description:
      'Numeric field for whole numbers without decimal places. Supports min/max range validation and is optimized for performance.',
    examples: [
      {
        id: 1,
        name: 'quantity',
        type: 'integer',
        required: true,
        min: 0,
        max: 1000,
        default: 1,
      },
      {
        id: 2,
        name: 'age',
        type: 'integer',
        required: false,
        min: 0,
        max: 150,
      },
    ],
  })
)

/** @public */
export type IntegerField = Schema.Schema.Type<typeof IntegerFieldSchema>
