/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Updated By Field
 *
 * Automatically captures the user who last modified a record.
 * This field is system-managed and cannot be manually edited.
 * Stores a reference to the user ID from the authentication system.
 * Automatically updates on every record update operation.
 * Commonly used for audit trails and tracking modification history.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'updated_by',
 *   type: 'updated-by',
 *   indexed: true
 * }
 * ```
 */
export const UpdatedByFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('updated-by'),
    })
  ),
  Schema.annotations({
    title: 'Updated By Field',
    description:
      'Automatically captures the user who last modified a record. System-managed field that stores user ID reference.',
    examples: [
      {
        id: 1,
        name: 'updated_by',
        type: 'updated-by',
        indexed: true,
      },
    ],
  })
)

export type UpdatedByField = Schema.Schema.Type<typeof UpdatedByFieldSchema>
