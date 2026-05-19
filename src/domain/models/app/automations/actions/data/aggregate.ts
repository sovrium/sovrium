/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const DataAggregateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data'),
  operator: Schema.Literal('aggregate'),
  props: Schema.Struct({
    input: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Template reference to the array of items to aggregate' })
    ),

    function: Schema.Literal('sum', 'avg', 'min', 'max', 'count').pipe(
      Schema.annotations({ description: 'Aggregation function to apply' })
    ),

    field: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Numeric field to aggregate (required for all functions except count)',
        })
      )
    ),

    groupBy: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({ description: 'Group results by this field before aggregating' })
      )
    ),
  }).pipe(
    Schema.filter((props) => {
      if (props.function !== 'count' && props.field === undefined) {
        return `"field" is required when function is "${props.function}"`
      }
      return true
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'DataAggregateAction',
    title: 'Data Aggregate Action',
    description: 'Compute sum/avg/min/max/count over a numeric field of an array',
  })
)

export type DataAggregateAction = Schema.Schema.Type<typeof DataAggregateActionSchema>
