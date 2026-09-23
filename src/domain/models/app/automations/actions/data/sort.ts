/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Data Sort Action (type: data, operator: sort)
 *
 * Reorder an array of records by a specified field, ascending or descending.
 */
export const DataSortActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data').pipe(
    Schema.annotate({
      description: "Constant value 'data' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('sort').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'data' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Template reference to the array of records to sort */
    input: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Template reference to the array of records to sort' })
    ),

    /** Field to sort by */
    field: TemplateStringSchema.pipe(Schema.annotate({ description: 'Field to sort by' })),

    /** Sort direction (default: asc) */
    direction: Schema.optional(
      Schema.Literals(['asc', 'desc']).pipe(
        Schema.annotate({ description: 'Sort direction (default: asc)' })
      )
    ),
  }).annotate({
    description: 'The list to order, the field to order it by, and which way round.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'DataSortAction',
    title: 'Data Sort Action',
    description: 'Reorder an array of records by a specified field and direction',
  })
)

/** @public */
export type DataSortAction = Schema.Schema.Type<typeof DataSortActionSchema>
