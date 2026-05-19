/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'
import { validateMinMaxRange } from '../validation-utils'

export const PercentageFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('percentage').pipe(
        Schema.annotations({
          description:
            "Constant value 'percentage' for type discrimination in discriminated unions",
        })
      ),
      precision: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(0),
          Schema.lessThanOrEqualTo(10),
          Schema.annotations({
            description: 'Number of decimal places (0-10, default: 0 for whole percentages)',
          })
        )
      ),
      min: Schema.optional(
        Schema.Number.pipe(
          Schema.annotations({
            description: 'Minimum allowed percentage value (inclusive, typically 0)',
          })
        )
      ),
      max: Schema.optional(
        Schema.Number.pipe(
          Schema.annotations({
            description: 'Maximum allowed percentage value (inclusive, typically 100)',
          })
        )
      ),
      default: Schema.optional(
        Schema.Number.pipe(
          Schema.annotations({
            description: 'Default percentage value when creating new records',
          })
        )
      ),
    })
  ),
  Schema.filter(validateMinMaxRange),
  Schema.annotations({
    title: 'Percentage Field',
    description:
      'Specialized numeric field for percentage values (0-100). Values automatically display with % symbol in UI. Supports configurable decimal precision.',
    examples: [
      {
        id: 1,
        name: 'discount_rate',
        type: 'percentage',
        required: true,
        precision: 1,
        min: 0,
        max: 100,
        default: 10.0,
      },
      {
        id: 2,
        name: 'completion',
        type: 'percentage',
        required: true,
        precision: 0,
        min: 0,
        max: 100,
        default: 0,
      },
    ],
  })
)

export type PercentageField = Schema.Schema.Type<typeof PercentageFieldSchema>
