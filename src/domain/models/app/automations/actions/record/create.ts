/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'

/**
 * Record Create Action (type: record, operator: create)
 *
 * Insert a new record into a table. Requires data payload.
 */
export const RecordCreateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record').pipe(
    Schema.annotate({
      description: "Constant value 'record' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('create').pipe(
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
      Schema.annotate({ description: 'Record field values (supports template variables)' })
    ),
    runAs: Schema.optional(
      Schema.Literals(['system', 'triggering-user']).pipe(
        Schema.annotate({
          description:
            "Action-ownership attribution for the write. 'system' (default): authorship (created-by / updated-by fields) is attributed to the durable system actor. 'triggering-user': attribute authorship — and the write session — to the user who triggered the automation when one exists (form submitter, record-event actor, authenticated webhook caller), falling back to the system actor for user-less triggers (cron, automation-call). Omitting the field is byte-identical to 'system'.",
        })
      )
    ),
  }).annotate({
    description: 'The table to insert into, the values to write, and whose permissions apply.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'RecordCreateAction',
    title: 'Record Create Action',
    description: 'Insert a new record into a table',
  })
)

/** @public */
export type RecordCreateAction = Schema.Schema.Type<typeof RecordCreateActionSchema>
