/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ViewFiltersSchema } from '../../../views/filters'
import { readerFilterRefusal } from '../../../views/reader-filter-validation'
import { BaseFieldSchema } from '../base-field'

export const CountFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('count').pipe(
      Schema.annotate({
        description: "Constant value 'count' for type discrimination in discriminated unions",
      })
    ),
    relationshipField: Schema.String.pipe(
      Schema.annotate({
        description:
          'Name of the relationship field in the same table to count linked records from',
      }),
      Schema.check(Schema.isNonEmpty({ message: 'relationshipField is required' }))
    ),
    filters: Schema.optional(
      ViewFiltersSchema.pipe(
        Schema.annotate({
          title: 'Count Filters',
          description: 'Filters to apply when counting linked records',
        })
      )
    ),
  }),
  Schema.annotate({
    title: 'Count Field',
    description:
      'Counts the linked records from a relationship field that its reader may list in the related table, optionally filtered first. A reader who may list none of them is not given the count.',
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
  }),
  // On the STRUCT so the refusal can name the field (see reader-filter-validation).
  Schema.check(Schema.makeFilter((field) => readerFilterRefusal(field)))
)

/** @public */
export type CountField = Schema.Schema.Type<typeof CountFieldSchema>
