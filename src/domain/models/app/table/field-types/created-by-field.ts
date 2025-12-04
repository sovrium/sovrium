/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Created By Field
 *
 * Automatically captures the user who created a record.
 * This field is system-managed and cannot be manually edited.
 * Stores a reference to the user ID from the authentication system.
 * Commonly used for audit trails and user activity tracking.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'created_by',
 *   type: 'created-by',
 *   indexed: true
 * }
 * ```
 */
export const CreatedByFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('created-by'),
    })
  ),
  Schema.annotations({
    title: 'Created By Field',
    description:
      'Automatically captures the user who created a record. System-managed field that stores user ID reference.',
    examples: [
      {
        id: 1,
        name: 'created_by',
        type: 'created-by',
        indexed: true,
      },
    ],
  })
)

export type CreatedByField = Schema.Schema.Type<typeof CreatedByFieldSchema>
