/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'
import { ViewFiltersSchema } from '../views/filters'

export const RollupFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('rollup'),
      relationshipField: Schema.String.pipe(
        Schema.minLength(1, { message: () => 'This field is required' }),
        Schema.annotations({ description: 'Name of the relationship field to aggregate from' })
      ),
      relatedField: Schema.String.pipe(
        Schema.minLength(1, { message: () => 'This field is required' }),
        Schema.annotations({ description: 'Name of the field in the related table to aggregate' })
      ),
      aggregation: Schema.String.pipe(
        Schema.annotations({ description: 'Aggregation function to apply' })
      ),
      format: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Display format for the result',
            examples: ['currency', 'number', 'percentage'],
          })
        )
      ),
      filters: Schema.optional(
        ViewFiltersSchema.pipe(
          Schema.annotations({ description: 'Filters to apply to the rollup aggregation' })
        )
      ),
    })
  )
).pipe(
  Schema.annotations({
    title: 'Rollup Field',
    description: 'Aggregates values from related records using functions like SUM, AVG, COUNT.',
    examples: [
      {
        id: 1,
        name: 'total_sales',
        type: 'rollup',
        relationshipField: 'orders',
        relatedField: 'amount',
        aggregation: 'SUM',
      },
    ],
  })
)

export type RollupField = Schema.Schema.Type<typeof RollupFieldSchema>
