/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

export const StatusFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('status'),
      options: Schema.Array(
        Schema.Struct({
          value: Schema.String.pipe(
            Schema.nonEmptyString({ message: () => 'value is required' })
          ),
          color: Schema.optional(
            Schema.String.pipe(
              Schema.pattern(/^#[0-9a-fA-F]{6}$/, {
                message: () => 'Hex color code for the status',
              }),
              Schema.annotations({
                description: 'Hex color code for the status',
              })
            )
          ),
        })
      ),
      default: Schema.optional(Schema.String),
    })
  ),
  Schema.annotations({
    title: 'Status Field',
    description: 'Status field with colored options for workflow states.',
    examples: [
      {
        id: 1,
        name: 'status',
        type: 'status',
        options: [
          { value: 'todo', color: '#94A3B8' },
          { value: 'in_progress', color: '#3B82F6' },
        ],
      },
    ],
  })
)

export type StatusField = Schema.Schema.Type<typeof StatusFieldSchema>
