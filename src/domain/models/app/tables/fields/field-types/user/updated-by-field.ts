/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

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
