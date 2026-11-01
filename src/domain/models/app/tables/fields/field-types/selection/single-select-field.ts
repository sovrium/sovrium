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
 * Single Select Field
 *
 * Allows selection of one option from a predefined list.
 * Commonly used for categories, statuses, or any enumerated values.
 * Supports optional default value selection. A rule that locks a record on its
 * value is declared on the table (`rules`), not on the field; the field's own
 * `conditions` key is refused (see `removed-keys.ts`).
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
  Schema.fieldsAssign({
    type: Schema.Literal('single-select').pipe(
      Schema.annotate({
        description:
          "Constant value 'single-select' for type discrimination in discriminated unions",
      })
    ),
    options: createOptionsSchema('single-select'),
    default: Schema.optional(
      Schema.String.annotate({
        description: 'Choice a new record starts on. It has to be one of the options.',
      })
    ),
  }),
  Schema.annotate({
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

/** @public */
export type SingleSelectField = Schema.Schema.Type<typeof SingleSelectFieldSchema>
