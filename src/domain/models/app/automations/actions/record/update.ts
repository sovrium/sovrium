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
  }),
}).pipe(
  Schema.annotations({
    identifier: 'RecordUpdateAction',
    title: 'Record Update Action',
    description: 'Update records matching filter conditions',
  })
)

/** @public */
export type RecordUpdateAction = Schema.Schema.Type<typeof RecordUpdateActionSchema>
