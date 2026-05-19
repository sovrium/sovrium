/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const DataLimitActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data'),
  operator: Schema.Literal('limit'),
  props: Schema.Struct({
    input: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Template reference to the array of items' })
    ),

    count: Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({ description: 'Maximum number of items to keep (positive integer)' })
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'DataLimitAction',
    title: 'Data Limit Action',
    description: 'Truncate an array to the first N items',
  })
)

export type DataLimitAction = Schema.Schema.Type<typeof DataLimitActionSchema>
