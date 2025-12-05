/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'
import { createOptionsSchema } from './validation-utils'

/**
 * Single Select Field
 *
 * Allows selection of one option from a predefined list.
 * Commonly used for categories, statuses, or any enumerated values.
 * Supports optional default value selection.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'category',
 *   type: 'single-select',
 *   options: ['Electronics', 'Clothing', 'Food'],
 *   default: 'Electronics'
 * }
 * ```
 */
export const SingleSelectFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('single-select'),
      options: createOptionsSchema('single-select'),
      default: Schema.optional(Schema.String),
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
