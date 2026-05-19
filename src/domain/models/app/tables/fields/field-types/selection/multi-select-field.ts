/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'
import { createOptionsSchema } from '../validation-utils'

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
      default: Schema.optional(
        Schema.Array(Schema.String).pipe(Schema.annotations({ title: 'Default Selections' }))
      ),
    })
  ),
  Schema.filter((field) => {
    if (field.maxSelections !== undefined && field.maxSelections > field.options.length) {
      return 'maxSelections exceeds available options'
    }
    return true
  }),
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
