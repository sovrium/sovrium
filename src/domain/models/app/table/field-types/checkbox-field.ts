/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

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
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('checkbox'),
      default: Schema.optional(Schema.Boolean),
    })
  ),
  Schema.annotations({
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

export type CheckboxField = Schema.Schema.Type<typeof CheckboxFieldSchema>
