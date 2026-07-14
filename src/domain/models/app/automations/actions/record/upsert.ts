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

export const RecordUpsertActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record'),
  operator: Schema.Literal('upsert'),
  props: Schema.Struct({
    table: Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Target table name' })
    ),
    data: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({
        description: 'Record field values to create or update (supports template variables)',
      })
    ),
    id: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Primary key of the record to upsert (mutually exclusive with filter)',
        })
      )
    ),
    filter: Schema.optional(ConditionGroupSchema),
    runAs: Schema.optional(
      Schema.Literal('system', 'triggering-user').pipe(
        Schema.annotations({
          description:
            "Action-ownership attribution for the write. 'system' (default): authorship (created-by on the create branch, updated-by on both branches) is attributed to the durable system actor. 'triggering-user': attribute authorship — and the write session — to the user who triggered the automation when one exists (form submitter, record-event actor, authenticated webhook caller), falling back to the system actor for user-less triggers (cron, automation-call). Omitting the field is byte-identical to 'system'.",
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'RecordUpsertAction',
    title: 'Record Upsert Action',
    description: 'Atomically create a record if not found, or update it if it exists',
  })
)

export type RecordUpsertAction = Schema.Schema.Type<typeof RecordUpsertActionSchema>
