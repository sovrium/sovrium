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

export const RecordReadActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record'),
  operator: Schema.Literal('read'),
  props: Schema.Struct({
    table: Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Target table name' })
    ),
    id: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({ description: 'Record id (or template) for primary-key reads' })
      )
    ),
    filter: Schema.optional(ConditionGroupSchema),
  }),
}).pipe(
  Schema.filter((action) => {
    const { id, filter } = action.props
    if (id === undefined && filter === undefined) {
      return 'record/read requires either props.id or props.filter to be provided'
    }
    return true
  }),
  Schema.annotations({
    identifier: 'RecordReadAction',
    title: 'Record Read Action',
    description: 'Query records from a table by primary key or filter conditions',
  })
)

export type RecordReadAction = Schema.Schema.Type<typeof RecordReadActionSchema>
