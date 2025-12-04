/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Created At Field
 *
 * Automatically captures the timestamp when a record is created.
 * This field is system-managed and cannot be manually edited.
 * Commonly used for audit trails and sorting by creation date.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'created_at',
 *   type: 'created-at',
 *   indexed: true
 * }
 * ```
 */
export const CreatedAtFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('created-at'),
    })
  ),
  Schema.annotations({
    title: 'Created At Field',
    description:
      'Automatically captures the timestamp when a record is created. System-managed field that cannot be manually edited.',
    examples: [
      {
        id: 1,
        name: 'created_at',
        type: 'created-at',
        indexed: true,
      },
    ],
  })
)

export type CreatedAtField = Schema.Schema.Type<typeof CreatedAtFieldSchema>
