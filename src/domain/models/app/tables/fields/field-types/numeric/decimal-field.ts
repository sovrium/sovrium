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
 * Decimal Field
 *
 * Numeric field for storing numbers with decimal places. Ideal for measurements,
 * calculations, percentages (as decimals), and any value requiring fractional precision.
 * Supports configurable precision (number of decimal places) and min/max range validation.
 * Can be marked as required, unique, or indexed. Stored using DECIMAL database type for
 * exact precision without floating-point errors.
 *
 * Business Rules:
 * - Precision defines number of decimal places (1-10), defaulting to 2 for common use cases
 * - DECIMAL storage ensures exact representation without floating-point rounding errors
 * - Min/max validation optional - useful for enforcing valid ranges
 * - Precision must be at least 1 (use Integer Field for whole numbers without decimals)
 * - Indexing recommended for fields used in sorting, filtering, or calculations
 * - Constant value 'decimal' ensures type safety and enables discriminated unions
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'weight',
 *   type: 'decimal',
 *   required: true,
 *   precision: 2,
 *   min: 0.01,
 *   max: 999.99,
 *   default: 1.00
 * }
 * ```
 */
export const DecimalFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('decimal').pipe(
      Schema.annotate({
        description: "Constant value 'decimal' for type discrimination in discriminated unions",
      })
    ),
    precision: Schema.optional(
      Schema.Int.pipe(
        Schema.annotate({
          description: 'Number of decimal places (1-10)',
        }),
        Schema.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(10))
      )
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
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Default decimal value when creating new records',
        })
      )
    ),
  }),
  Schema.annotate({
    title: 'Decimal Field',
    description:
      'Numeric field for numbers with decimal places. Supports configurable precision (1-10 decimal places) and min/max range validation. Uses exact DECIMAL storage.',
    examples: [
      {
        id: 1,
        name: 'weight',
        type: 'decimal',
        required: true,
        precision: 2,
        min: 0.01,
        max: 999.99,
        default: 1.0,
      },
      {
        id: 2,
        name: 'tax_rate',
        type: 'decimal',
        required: true,
        precision: 4,
        min: 0,
        max: 1,
        default: 0.0825,
      },
    ],
  }),
  Schema.check(Schema.makeFilter(validateMinMaxRange))
)

/** @public */
export type DecimalField = Schema.Schema.Type<typeof DecimalFieldSchema>
