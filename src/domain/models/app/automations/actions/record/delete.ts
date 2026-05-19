/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConditionGroupSchema } from '../../conditions'
import { ActionBaseFields } from '../base'

export const RecordDeleteActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record'),
  operator: Schema.Literal('delete'),
  props: Schema.Struct({
    table: Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Target table name' })
    ),
    filter: ConditionGroupSchema,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'RecordDeleteAction',
    title: 'Record Delete Action',
    description: 'Delete records matching filter conditions',
  })
)

export type RecordDeleteAction = Schema.Schema.Type<typeof RecordDeleteActionSchema>
