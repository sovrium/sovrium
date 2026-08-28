/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'
import {
  CurrencyCodeSchema,
  CurrencyNegativeFormatSchema,
  CurrencyPrecisionSchema,
  CurrencySymbolPositionSchema,
  CurrencyThousandsSeparatorSchema,
} from '../currency-display'
import { validateMinMaxRange } from '../validation-utils'

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
  Schema.fieldsAssign({
    type: Schema.Literal('currency').pipe(
      Schema.annotate({
        description: "Constant value 'currency' for type discrimination in discriminated unions",
      })
    ),
    currency: CurrencyCodeSchema,
    precision: Schema.optional(CurrencyPrecisionSchema),
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
    symbolPosition: Schema.optional(CurrencySymbolPositionSchema),
    negativeFormat: Schema.optional(CurrencyNegativeFormatSchema),
    thousandsSeparator: Schema.optional(CurrencyThousandsSeparatorSchema),
    default: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Default currency value when creating new records',
        })
      )
    ),
  }),
  Schema.check(Schema.makeFilter(validateMinMaxRange)),
  Schema.annotate({
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
