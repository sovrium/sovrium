/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'
import { createOptionsSchema } from '../validation-utils'

export const SingleSelectFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('single-select'),
      options: createOptionsSchema('single-select'),
      default: Schema.optional(Schema.String),
      conditions: Schema.optional(
        Schema.Array(
          Schema.Struct({
            when: Schema.String.pipe(
              Schema.annotations({
                description: 'Option value that triggers the condition',
              })
            ),
            then: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
              Schema.annotations({
                description: 'Property changes to apply when condition matches',
              })
            ),
          })
        ).pipe(
          Schema.annotations({
            description:
              'Behavioral conditions: when a specific option is selected, apply property changes (e.g., readOnly)',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Single Select Field',
    description:
      'Allows selection of one option from predefined list. Used for categories or enumerated values.',
    examples: [
      {
        id: 1,
        name: 'category',
        type: 'single-select',
        options: ['Electronics', 'Clothing', 'Food'],
        default: 'Electronics',
      },
    ],
  })
)

export type SingleSelectField = Schema.Schema.Type<typeof SingleSelectFieldSchema>
