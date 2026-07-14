/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConditionGroupSchema } from '../../conditions'
import { ActionBaseFields } from '../base'

export const RecordUpdateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record'),
  operator: Schema.Literal('update'),
  props: Schema.Struct({
    table: Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Target table name' })
    ),
    data: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({ description: 'Fields to update (supports template variables)' })
    ),
    filter: ConditionGroupSchema,
    runAs: Schema.optional(
      Schema.Literal('system', 'triggering-user').pipe(
        Schema.annotations({
          description:
            "Action-ownership attribution for the write. 'system' (default): the updated-by field is attributed to the durable system actor. 'triggering-user': attribute the updated-by field — and the write session — to the user who triggered the automation when one exists (form submitter, record-event actor, authenticated webhook caller), falling back to the system actor for user-less triggers (cron, automation-call). Omitting the field is byte-identical to 'system'.",
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'RecordUpdateAction',
    title: 'Record Update Action',
    description: 'Update records matching filter conditions',
  })
)

export type RecordUpdateAction = Schema.Schema.Type<typeof RecordUpdateActionSchema>
