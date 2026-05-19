/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConditionGroupSchema } from '../../conditions'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const RecordBatchDeleteActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record'),
  operator: Schema.Literal('batchDelete'),
  props: Schema.Struct({
    table: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Table to delete records from' })
    ),

    filter: ConditionGroupSchema.pipe(
      Schema.annotations({
        description: 'Condition to match records for deletion',
      })
    ),

    limit: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 10_000),
        Schema.annotations({
          description: 'Maximum records to delete (1-10000, safety limit)',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'RecordBatchDeleteAction',
    title: 'Record Batch Delete Action',
    description: 'Delete multiple records matching a filter condition',
  })
)

export type RecordBatchDeleteAction = Schema.Schema.Type<typeof RecordBatchDeleteActionSchema>
