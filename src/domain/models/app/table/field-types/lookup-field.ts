/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'
import { ViewFiltersSchema } from '../views/filters'

export const LookupFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('lookup'),
      relationshipField: Schema.String.pipe(
        Schema.minLength(1, { message: () => 'This field is required' }),
        Schema.annotations({ description: 'Name of the relationship field to lookup from' })
      ),
      relatedField: Schema.String.pipe(
        Schema.minLength(1, { message: () => 'This field is required' }),
        Schema.annotations({ description: 'Name of the field in the related table to display' })
      ),
      filters: Schema.optional(
        ViewFiltersSchema.pipe(
          Schema.annotations({ description: 'Filters to apply to the lookup results' })
        )
      ),
    })
  )
).pipe(
  Schema.annotations({
    title: 'Lookup Field',
    description: 'Displays values from related records without aggregation.',
    examples: [
      {
        id: 1,
        name: 'customer_email',
        type: 'lookup',
        relationshipField: 'customer',
        relatedField: 'email',
      },
    ],
  })
)

export type LookupField = Schema.Schema.Type<typeof LookupFieldSchema>
