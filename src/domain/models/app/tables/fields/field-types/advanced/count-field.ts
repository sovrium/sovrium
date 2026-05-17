/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ViewFiltersSchema } from '../../../views/filters'
import { BaseFieldSchema } from '../base-field'

export const CountFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('count'),
      relationshipField: Schema.String.pipe(
        Schema.nonEmptyString({ message: () => 'relationshipField is required' }),
        Schema.annotations({
          description:
            'Name of the relationship field in the same table to count linked records from',
        })
      ),
      filters: Schema.optional(
        ViewFiltersSchema.pipe(
          Schema.annotations({
            title: 'Count Filters',
            description: 'Filters to apply when counting linked records',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Count Field',
    description:
      'Counts the number of linked records from a relationship field. Optionally filters records before counting.',
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
        filters: { field: 'status', operator: 'equals', value: 'completed' },
      },
    ],
  })
)

/** @public */
export type CountField = Schema.Schema.Type<typeof CountFieldSchema>
