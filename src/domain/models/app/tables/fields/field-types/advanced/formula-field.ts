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

export const FormulaFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('formula').pipe(
      Schema.annotate({
        description: "Constant value 'formula' for type discrimination in discriminated unions",
      })
    ),
    formula: Schema.String.pipe(
      Schema.annotate({
        description:
          'Formula expression to compute the value. Supports field references, operators, and functions.',
        examples: [
          'price * quantity',
          "CONCAT(first_name, ' ', last_name)",
          "IF(status = 'active', 'Yes', 'No')",
          'ROUND(total * 0.15, 2)',
        ],
      }),
      Schema.check(Schema.isNonEmpty({ message: 'formula is required' }))
    ),
    resultType: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({ description: 'Expected data type of the formula result' })
      )
    ),
    format: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'Display format for the result (e.g., currency, percentage)',
          examples: ['currency', 'percentage', 'decimal', 'date'],
        })
      )
    ),
    /**
     * The currency a monetary result is rendered in.
     *
     * A formula over money is still money, but the renderer took the SYMBOL
     * from the field type rather than from a declared code, so a computed
     * `unit_price * stock_on_hand` printed `$224,430.90` beside the `€28.63`
     * it was multiplied from — and no valid config could correct it, because
     * `sovrium validate` rejects undeclared keys.
     *
     * Explicit, never inferred. There is deliberately no "inherit the code
     * from the field the formula references": a formula is an arbitrary
     * expression that may touch several fields or none, so any such rule
     * would have to pick one silently and would repoint the symbol the day
     * somebody edits the expression. Undeclared means the existing USD
     * defaults, exactly as before.
     */
    currency: Schema.optional(
      CurrencyCodeSchema.annotate({
        description:
          'ISO 4217 code the computed amount is rendered in (e.g., USD, EUR, GBP). Applies when the value is displayed as currency; undeclared falls back to USD.',
        examples: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
      })
    ),
    precision: Schema.optional(CurrencyPrecisionSchema),
    symbolPosition: Schema.optional(CurrencySymbolPositionSchema),
    negativeFormat: Schema.optional(CurrencyNegativeFormatSchema),
    thousandsSeparator: Schema.optional(CurrencyThousandsSeparatorSchema),
  }),
  Schema.annotate({
    title: 'Formula Field',
    description: 'Computed field that calculates values based on formula expressions.',
    examples: [
      {
        id: 1,
        name: 'total_price',
        type: 'formula',
        formula: 'price * quantity',
        resultType: 'number',
      },
      {
        id: 2,
        name: 'stock_value',
        type: 'formula',
        formula: 'unit_price * stock_on_hand',
        resultType: 'number',
        format: 'currency',
        currency: 'EUR',
      },
    ],
  })
)

/** @public */
export type FormulaField = Schema.Schema.Type<typeof FormulaFieldSchema>
