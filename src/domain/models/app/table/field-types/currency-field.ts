/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Currency Field
 *
 * Specialized numeric field for storing monetary values with currency information.
 * Automatically formats values with currency symbols and stores precise decimal amounts.
 * Supports configurable currency codes (USD, EUR, GBP, etc.) and precision (typically 2
 * decimal places). Can be marked as required, unique, or indexed. Stored using DECIMAL
 * database type to prevent rounding errors in financial calculations.
 *
 * Business Rules:
 * - Currency code must be valid ISO 4217 three-letter code (USD, EUR, GBP, etc.)
 * - Precision defaults to 2 decimal places (standard for most currencies)
 * - DECIMAL storage ensures exact monetary amounts without floating-point errors
 * - Min/max validation optional - useful for enforcing business rules (e.g., price >= 0)
 * - Currency code stored with value to support multi-currency applications
 * - Indexing recommended for fields used in financial reports and sorting
 * - Constant value 'currency' ensures type safety and enables discriminated unions
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'price',
 *   type: 'currency',
 *   required: true,
 *   currency: 'USD',
 *   precision: 2,
 *   min: 0,
 *   default: 0.00
 * }
 * ```
 */
export const CurrencyFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('currency').pipe(
        Schema.annotations({
          description: "Constant value 'currency' for type discrimination in discriminated unions",
        })
      ),
      currency: Schema.String.pipe(
        Schema.length(3),
        Schema.pattern(/^[A-Z]{3}$/),
        Schema.annotations({
          description: 'ISO 4217 three-letter currency code (e.g., USD, EUR, GBP)',
          examples: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
        })
      ),
      precision: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(0),
          Schema.lessThanOrEqualTo(10),
          Schema.annotations({
            description: 'Number of decimal places (0-10, default: 2 for most currencies)',
          })
        )
      ),
      min: Schema.optional(
        Schema.Number.pipe(
          Schema.annotations({
            description: 'Minimum allowed value (inclusive)',
          })
        )
      ),
      max: Schema.optional(
        Schema.Number.pipe(
          Schema.annotations({
            description: 'Maximum allowed value (inclusive)',
          })
        )
      ),
      symbolPosition: Schema.optional(
        Schema.Literal('before', 'after').pipe(
          Schema.annotations({
            description: 'Position of currency symbol relative to the amount',
            examples: ['before', 'after'],
          })
        )
      ),
      negativeFormat: Schema.optional(
        Schema.Literal('minus', 'parentheses').pipe(
          Schema.annotations({
            description: 'Format for displaying negative amounts',
            examples: ['minus', 'parentheses'],
          })
        )
      ),
      thousandsSeparator: Schema.optional(
        Schema.Literal('comma', 'period', 'space', 'none').pipe(
          Schema.annotations({
            description: 'Character used to separate thousands',
            examples: ['comma', 'period', 'space', 'none'],
          })
        )
      ),
      default: Schema.optional(
        Schema.Number.pipe(
          Schema.annotations({
            description: 'Default currency value when creating new records',
          })
        )
      ),
    })
  )
).pipe(
  Schema.annotations({
    title: 'Currency Field',
    description:
      'Specialized numeric field for monetary values with currency codes (ISO 4217). Uses exact DECIMAL storage to prevent rounding errors in financial calculations.',
    examples: [
      {
        id: 1,
        name: 'price',
        type: 'currency',
        required: true,
        currency: 'USD',
        precision: 2,
        min: 0,
        default: 0.0,
      },
      {
        id: 2,
        name: 'total_cost',
        type: 'currency',
        required: true,
        currency: 'EUR',
        precision: 2,
      },
    ],
  })
)

export type CurrencyField = Schema.Schema.Type<typeof CurrencyFieldSchema>
