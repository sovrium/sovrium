/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'
import { validateMinMaxRange } from '../validation-utils'

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
  ),
  Schema.filter(validateMinMaxRange),
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
