/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

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
