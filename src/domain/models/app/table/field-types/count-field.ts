/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ViewFilterConditionSchema } from '../views/filters'
import { BaseFieldSchema } from './base-field'

export const CountFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('count'),
      relationshipField: Schema.String.pipe(
        Schema.minLength(1, { message: () => 'This field is required' }),
        Schema.annotations({
          description: 'Name of the relationship field in the same table to count linked records from',
        })
      ),
      conditions: Schema.optional(
        Schema.Array(ViewFilterConditionSchema).pipe(
          Schema.annotations({
            description: 'Filter conditions to apply when counting linked records',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Count Field',
    description:
      'Counts the number of linked records from a relationship field. Optionally filters records with conditions.',
    examples: [
      {
        id: 1,
        name: 'task_count',
        type: 'count',
        relationshipField: 'tasks',
      },
      {
        id: 2,
        name: 'completed_task_count',
        type: 'count',
        relationshipField: 'tasks',
        conditions: [{ field: 'status', operator: 'equals', value: 'completed' }],
      },
    ],
  })
)

export type CountField = Schema.Schema.Type<typeof CountFieldSchema>
