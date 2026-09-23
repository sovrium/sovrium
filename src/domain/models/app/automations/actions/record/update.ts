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
 * Record Update Action (type: record, operator: update)
 *
 * Update existing records matching a filter. Requires both data and filter.
 */
export const RecordUpdateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record').pipe(
    Schema.annotate({
      description: "Constant value 'record' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('update').pipe(
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
    data: Schema.Record(Schema.String, Schema.Unknown).pipe(
      Schema.annotate({ description: 'Fields to update (supports template variables)' })
    ),
    filter: ConditionGroupSchema,
    runAs: Schema.optional(
      Schema.Literals(['system', 'triggering-user']).pipe(
        Schema.annotate({
          description:
            "Action-ownership attribution for the write. 'system' (default): the updated-by field is attributed to the durable system actor. 'triggering-user': attribute the updated-by field — and the write session — to the user who triggered the automation when one exists (form submitter, record-event actor, authenticated webhook caller), falling back to the system actor for user-less triggers (cron, automation-call). Omitting the field is byte-identical to 'system'.",
        })
      )
    ),
  }).annotate({
    description: 'The table, which record to change, the new values, and whose permissions apply.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'RecordUpdateAction',
    title: 'Record Update Action',
    description: 'Update records matching filter conditions',
  })
)

/** @public */
export type RecordUpdateAction = Schema.Schema.Type<typeof RecordUpdateActionSchema>
