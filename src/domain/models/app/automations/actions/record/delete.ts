/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConditionGroupSchema } from '../../conditions'
import { ActionBaseFields } from '../base'

/**
 * Record Delete Action (type: record, operator: delete)
 *
 * Delete records matching a filter.
 */
export const RecordDeleteActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record').pipe(
    Schema.annotate({
      description: "Constant value 'record' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('delete').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'record' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    table: Schema.String.pipe(
      Schema.annotate({ description: 'Target table name' }),
      Schema.check(Schema.isMinLength(1))
    ),
    filter: ConditionGroupSchema,
  }).annotate({
    description: 'The table, and which record to delete.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'RecordDeleteAction',
    title: 'Record Delete Action',
    description: 'Delete records matching filter conditions',
  })
)

/** @public */
export type RecordDeleteAction = Schema.Schema.Type<typeof RecordDeleteActionSchema>
