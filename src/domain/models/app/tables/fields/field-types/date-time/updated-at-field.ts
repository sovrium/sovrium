/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const UpdatedAtFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('updated-at'),
    })
  ),
  Schema.annotations({
    title: 'Updated At Field',
    description:
      'Automatically updates the timestamp whenever a record is modified. System-managed field that updates on every change.',
    examples: [
      {
        id: 1,
        name: 'updated_at',
        type: 'updated-at',
        indexed: true,
      },
    ],
  })
)

export type UpdatedAtField = Schema.Schema.Type<typeof UpdatedAtFieldSchema>
