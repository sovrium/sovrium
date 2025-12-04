/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ViewFiltersSchema } from '../views/filters'
import { BaseFieldSchema } from './base-field'

export const CountFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('count'),
      relationshipField: Schema.String.pipe(
        Schema.minLength(1, { message: () => 'This field is required' }),
        Schema.annotations({
          description: 'Name of the relationship field in the related table to count',
        })
      ),
      conditions: Schema.optional(
        ViewFiltersSchema.pipe(
          Schema.annotations({
            description: 'Conditions to filter which linked records are counted',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Count Field',
    description: 'Counts the number of linked records in a relationship field.',
    examples: [
      {
        id: 1,
        name: 'task_count',
        type: 'count',
        relationshipField: 'project_id',
      },
    ],
  })
)

export type CountField = Schema.Schema.Type<typeof CountFieldSchema>
