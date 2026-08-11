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
  type: Schema.Literal('record'),
  table: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'Name of the table to watch for record events' })
  ),
  events: Schema.Array(Schema.Literal('create', 'update', 'delete')).pipe(
    Schema.minItems(1),
    Schema.annotations({ description: 'Record events that trigger this automation' })
  ),
  watchFields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Only trigger on update when these fields change' })
    )
  ),
  condition: Schema.optional(ConditionGroupSchema),
}).pipe(
  Schema.annotations({
    identifier: 'RecordTrigger',
    title: 'Record Trigger',
    description: 'Trigger automation when records are created, updated, or deleted',
  })
)

/** @public */
export type RecordTrigger = Schema.Schema.Type<typeof RecordTriggerSchema>
