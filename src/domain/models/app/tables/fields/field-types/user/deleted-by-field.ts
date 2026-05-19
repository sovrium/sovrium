/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

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
