/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * Checkbox Field
 *
 * Boolean field that stores true/false values.
 * Typically rendered as a checkbox in the UI.
 * Supports optional default value and database indexing.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'is_active',
 *   type: 'checkbox',
 *   required: true,
 *   default: false
 * }
 * ```
 */
export const CheckboxFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('checkbox').pipe(
      Schema.annotate({
        description: "Constant value 'checkbox' for type discrimination in discriminated unions",
      })
    ),
    default: Schema.optional(
      Schema.Boolean.annotate({ description: 'Whether a new record starts out ticked.' })
    ),
  }),
  Schema.annotate({
    title: 'Checkbox Field',
    description: 'Boolean field for true/false values. Typically rendered as a checkbox in the UI.',
    examples: [
      {
        id: 1,
        name: 'is_active',
        type: 'checkbox',
        required: true,
        default: false,
      },
    ],
  })
)

/** @public */
export type CheckboxField = Schema.Schema.Type<typeof CheckboxFieldSchema>
