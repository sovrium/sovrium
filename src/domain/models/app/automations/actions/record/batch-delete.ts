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

/**
 * Record Batch Delete Action (type: record, operator: batchDelete)
 *
 * Delete multiple records matching a filter condition.
 * Optional `limit` prevents accidental mass deletion.
 */
export const RecordBatchDeleteActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record').pipe(
    Schema.annotate({
      description: "Constant value 'record' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('batchDelete').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'record' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Target table name */
    table: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Table to delete records from' })
    ),

    /** Filter condition to match records for deletion */
    filter: ConditionGroupSchema.pipe(
      Schema.annotate({
        description: 'Condition to match records for deletion',
      })
    ),

    /** Maximum records to delete (safety limit) */
    limit: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          howTo:
            'On a batch delete this is a safety threshold, not a page size: exceeding it fails the run and deletes nothing.',
          description: 'Maximum records to delete (1-10000, safety limit)',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10_000 }))
      )
    ),
  }).annotate({
    description: 'The table, which records to delete, and how many at most.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'RecordBatchDeleteAction',
    title: 'Record Batch Delete Action',
    description: 'Delete multiple records matching a filter condition',
  })
)

/** @public */
export type RecordBatchDeleteAction = Schema.Schema.Type<typeof RecordBatchDeleteActionSchema>
