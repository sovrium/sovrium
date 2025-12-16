/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Deleted By Field
 *
 * Automatically captures the user who soft-deleted a record.
 * This field is system-managed and cannot be manually edited.
 * Stores a reference to the user ID from the authentication system.
 * Only populated when a record is soft-deleted (when deleted_at is set).
 * NULL indicates the record has not been deleted or was deleted by a system process.
 *
 * Commonly used for:
 * - Audit trails (who deleted what)
 * - Compliance reporting
 * - Accountability tracking
 * - Deletion history
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'deleted_by',
 *   type: 'deleted-by',
 *   indexed: true
 * }
 * ```
 */
export const DeletedByFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('deleted-by'),
    })
  ),
  Schema.annotations({
    title: 'Deleted By Field',
    description:
      'Automatically captures the user who soft-deleted a record. System-managed field that stores user ID reference. NULL when record is active or deleted by system process.',
    examples: [
      {
        id: 1,
        name: 'deleted_by',
        type: 'deleted-by',
        indexed: true,
      },
    ],
  })
)

export type DeletedByField = Schema.Schema.Type<typeof DeletedByFieldSchema>
