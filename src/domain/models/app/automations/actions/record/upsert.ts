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
  }),
}).pipe(
  Schema.annotations({
    identifier: 'RecordUpsertAction',
    title: 'Record Upsert Action',
    description: 'Atomically create a record if not found, or update it if it exists',
  })
)

/** @public */
export type RecordUpsertAction = Schema.Schema.Type<typeof RecordUpsertActionSchema>
