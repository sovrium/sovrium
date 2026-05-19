/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const DataSortActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data'),
  operator: Schema.Literal('sort'),
  props: Schema.Struct({
    input: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Template reference to the array of records to sort' })
    ),

    field: TemplateStringSchema.pipe(Schema.annotations({ description: 'Field to sort by' })),

    direction: Schema.optional(
      Schema.Literal('asc', 'desc').pipe(
        Schema.annotations({ description: 'Sort direction (default: asc)' })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'DataSortAction',
    title: 'Data Sort Action',
    description: 'Reorder an array of records by a specified field and direction',
  })
)

export type DataSortAction = Schema.Schema.Type<typeof DataSortActionSchema>
