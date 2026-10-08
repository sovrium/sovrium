/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConditionGroupSchema } from '../conditions'

/**
 * Record Trigger
 *
 * Triggered by record CRUD operations on a specific table.
 */
export const RecordTriggerSchema = Schema.Struct({
  type: Schema.Literal('record').pipe(
    Schema.annotate({
      description: "Constant value 'record' for type discrimination in discriminated unions",
    })
  ),
  table: Schema.String.pipe(
    Schema.annotate({ description: 'Name of the table to watch for record events' }),
    Schema.check(Schema.isMinLength(1))
  ),
  events: Schema.Array(Schema.Literals(['create', 'update', 'delete', 'restore'])).pipe(
    Schema.annotate({
      description:
        'Record events that trigger this automation. `restore` fires when a deleted record is brought back from the trash, once per record restored; it is not a `create`, so an automation that greets new records does not run again for one that already existed.',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  watchFields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotate({ description: 'Only trigger on update when these fields change' }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  condition: Schema.optional(ConditionGroupSchema),
}).pipe(
  Schema.annotate({
    identifier: 'RecordTrigger',
    title: 'Record Trigger',
    description:
      'Trigger automation when records are created, updated, or deleted. The run reads the row as stored at trigger.data.record (id, created_at, updated_at and the stamped columns included) and, for a record created through the records API or written by an automation step, who made the write at trigger.user ({ id, role }, or system for a write no person made).',
  })
)

/** @public */
export type RecordTrigger = Schema.Schema.Type<typeof RecordTriggerSchema>
