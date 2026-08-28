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
 * Record Upsert Action (type: record, operator: upsert)
 *
 * Atomic create-or-update on a single record. Requires a `table`,
 * `data` payload, and either an `id` (primary key lookup) or a `filter`
 * with conditions to match the existing record. If a match is found
 * the record is updated; otherwise a new record is created.
 *
 * The `id` and `filter` props are mutually exclusive — providing both
 * is a schema validation error (enforced in the cross-validation layer).
 */
export const RecordUpsertActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record'),
  operator: Schema.Literal('upsert'),
  props: Schema.Struct({
    table: Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({ description: 'Target table name' })
    ),
    data: Schema.Record(Schema.String, Schema.Unknown).pipe(
      Schema.annotate({
        description: 'Record field values to create or update (supports template variables)',
      })
    ),
    id: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Primary key of the record to upsert (mutually exclusive with filter)',
        })
      )
    ),
    filter: Schema.optional(ConditionGroupSchema),
    runAs: Schema.optional(
      Schema.Literals(['system', 'triggering-user']).pipe(
        Schema.annotate({
          description:
            "Action-ownership attribution for the write. 'system' (default): authorship (created-by on the create branch, updated-by on both branches) is attributed to the durable system actor. 'triggering-user': attribute authorship — and the write session — to the user who triggered the automation when one exists (form submitter, record-event actor, authenticated webhook caller), falling back to the system actor for user-less triggers (cron, automation-call). Omitting the field is byte-identical to 'system'.",
        })
      )
    ),
  }),
}).pipe(
  Schema.annotate({
    identifier: 'RecordUpsertAction',
    title: 'Record Upsert Action',
    description: 'Atomically create a record if not found, or update it if it exists',
  })
)

/** @public */
export type RecordUpsertAction = Schema.Schema.Type<typeof RecordUpsertActionSchema>
