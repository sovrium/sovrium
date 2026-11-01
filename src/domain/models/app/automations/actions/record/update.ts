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

const RECORD_UPDATE_ANNOTATIONS = {
  identifier: 'RecordUpdateAction',
  title: 'Record Update Action',
  description: 'Update one record by its id, or every record matching filter conditions',
} as const

/**
 * Record Update Action (type: record, operator: update)
 *
 * Update existing records. Requires `data`, and names the rows to change by
 * exactly one of `id` (one record, by primary key) or `filter` (every record
 * matching the conditions).
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
    id: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Primary key of the one record to update, such as "{{trigger.data.orderId}}" (exclusive with filter)',
        })
      )
    ),
    filter: Schema.optional(ConditionGroupSchema),
    runAs: Schema.optional(
      Schema.Literals(['system', 'triggering-user']).pipe(
        Schema.annotate({
          description:
            "Action-ownership attribution for the write. 'system' (default): the updated-by field is attributed to the durable system actor. 'triggering-user': attribute the updated-by field, and the write session, to the user who triggered the automation when one exists (form submitter, record-event actor, authenticated webhook caller), falling back to the system actor for user-less triggers (a cron schedule, or an automation-call from a run nobody started). Omitting the field is byte-identical to 'system'. A run someone started by hand (a manual trigger, a table button, an MCP action template or automation tool), and any automation it calls through automation-call at any depth, is always attributed to that person, whatever this option says.",
        })
      )
    ),
  }).annotate({
    description: 'The table, which record to change, the new values, and whose permissions apply.',
  }),
}).pipe(
  Schema.annotate(RECORD_UPDATE_ANNOTATIONS),
  Schema.check(
    Schema.makeFilter((action) => {
      const { id, filter } = action.props
      if (id !== undefined && filter !== undefined) {
        return 'record/update names its rows by `id` or by `filter`, not both'
      }
      if (id === undefined && filter === undefined) {
        return 'record/update needs an `id` or a `filter` naming the rows to change'
      }
      return undefined
    })
  ),
  // Annotated on both sides of the check: the JSON Schema reads the outermost
  // node, the docs walk the node's own annotations.
  Schema.annotate(RECORD_UPDATE_ANNOTATIONS)
)

/** @public */
export type RecordUpdateAction = Schema.Schema.Type<typeof RecordUpdateActionSchema>
