/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Deleted At Field
 *
 * Captures the timestamp when a record is soft-deleted.
 * When NULL, the record is considered active (not deleted).
 * When set, the record is considered soft-deleted and should be
 * excluded from normal queries.
 *
 * This field enables soft delete functionality, allowing records
 * to be "deleted" without permanent removal, supporting:
 * - Record restoration
 * - Audit trails
 * - Data recovery
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'deleted_at',
 *   type: 'deleted-at',
 *   indexed: true
 * }
 * ```
 */
export const DeletedAtFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('deleted-at'),
    })
  ),
  Schema.annotations({
    title: 'Deleted At Field',
    description:
      'Captures the timestamp when a record is soft-deleted. NULL indicates the record is active. Enables soft delete with record restoration capability.',
    examples: [
      {
        id: 1,
        name: 'deleted_at',
        type: 'deleted-at',
        indexed: true,
      },
    ],
  })
)

export type DeletedAtField = Schema.Schema.Type<typeof DeletedAtFieldSchema>
