/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

export const FormulaFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('formula'),
      formula: Schema.String.pipe(
        Schema.minLength(1, { message: () => 'This field is required' }),
        Schema.annotations({
          description:
            'Formula expression to compute the value. Supports field references, operators, and functions.',
          examples: [
            'price * quantity',
            "CONCAT(first_name, ' ', last_name)",
            "IF(status = 'active', 'Yes', 'No')",
            'ROUND(total * 0.15, 2)',
          ],
        })
      ),
      resultType: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({ description: 'Expected data type of the formula result' })
        )
      ),
      format: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Display format for the result (e.g., currency, percentage)',
            examples: ['currency', 'percentage', 'decimal', 'date'],
          })
        )
      ),
    })
  ),
  Schema.annotations({
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
    ],
  })
)

export type FormulaField = Schema.Schema.Type<typeof FormulaFieldSchema>
