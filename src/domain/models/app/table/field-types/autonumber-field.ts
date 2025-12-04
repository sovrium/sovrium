/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

export const AutonumberFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('autonumber'),
      prefix: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Optional prefix for the autonumber',
            examples: ['INV-', 'ORD-', ''],
          })
        )
      ),
      startFrom: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(1),
          Schema.annotations({ description: 'Starting number' })
        )
      ),
      digits: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(1),
          Schema.lessThanOrEqualTo(10),
          Schema.annotations({ description: 'Number of digits with zero padding' })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Autonumber Field',
    description: 'Auto-incrementing number field with optional prefix and zero padding.',
    examples: [
      {
        id: 1,
        name: 'invoice_number',
        type: 'autonumber',
        prefix: 'INV-',
        startFrom: 1000,
        digits: 5,
      },
    ],
  })
)

export type AutonumberField = Schema.Schema.Type<typeof AutonumberFieldSchema>
