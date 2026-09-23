/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'
import { createOptionsSchema } from '../validation-utils'

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
  Schema.fieldsAssign({
    type: Schema.Literal('multi-select').pipe(
      Schema.annotate({
        description:
          "Constant value 'multi-select' for type discrimination in discriminated unions",
      })
    ),
    options: createOptionsSchema('multi-select'),
    maxSelections: Schema.optional(
      Schema.Int.pipe(
        Schema.annotate({
          description: 'Maximum number of selections allowed',
        }),
        Schema.check(Schema.isGreaterThanOrEqualTo(1))
      )
    ),
    default: Schema.optional(
      Schema.Array(
        Schema.String.annotate({
          description: 'One choice a new record starts with. It has to be one of the options.',
        })
      ).pipe(
        Schema.annotate({
          title: 'Default Selections',
          description: 'Choices a new record starts with. Each one has to be one of the options.',
        })
      )
    ),
  }),
  Schema.annotate({
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
  }),
  Schema.check(
    Schema.makeFilter((field) => {
      if (field.maxSelections !== undefined && field.maxSelections > field.options.length) {
        return 'maxSelections exceeds available options'
      }
      return true
    })
  )
)

/** @public */
export type MultiSelectField = Schema.Schema.Type<typeof MultiSelectFieldSchema>
