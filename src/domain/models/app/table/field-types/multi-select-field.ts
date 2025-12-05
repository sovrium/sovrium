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
 * Multi Select Field
 *
 * Allows selection of multiple options from a predefined list.
 * Commonly used for tags, categories, or any multi-valued selections.
 * Supports optional default value array and maximum selection limit.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'tags',
 *   type: 'multi-select',
 *   options: ['Urgent', 'Important', 'Review'],
 *   maxSelections: 3,
 *   default: ['Important']
 * }
 * ```
 */
export const MultiSelectFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('multi-select'),
      options: createOptionsSchema('multi-select'),
      maxSelections: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(1),
          Schema.annotations({
            description: 'Maximum number of selections allowed',
          })
        )
      ),
      default: Schema.optional(Schema.Array(Schema.String)),
    })
  ),
  Schema.annotations({
    title: 'Multi Select Field',
    description: 'Allows selection of multiple options from predefined list.',
    examples: [
      {
        id: 1,
        name: 'tags',
        type: 'multi-select',
        options: ['Urgent', 'Important', 'Review'],
        maxSelections: 3,
      },
    ],
  })
)

export type MultiSelectField = Schema.Schema.Type<typeof MultiSelectFieldSchema>
