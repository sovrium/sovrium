/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

export const ArrayFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('array'),
      itemType: Schema.optional(
        Schema.String.pipe(Schema.annotations({ description: 'Type of items in the array' }))
      ),
      maxItems: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(1),
          Schema.annotations({ description: 'Maximum number of items allowed' })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Array Field',
    description: 'Stores arrays of values with optional type and length constraints.',
    examples: [{ id: 1, name: 'tags', type: 'array', itemType: 'string', maxItems: 10 }],
  })
)

export type ArrayField = Schema.Schema.Type<typeof ArrayFieldSchema>
