/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'

export const RecordCreateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record'),
  operator: Schema.Literal('create'),
  props: Schema.Struct({
    table: Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Target table name' })
    ),
    data: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({ description: 'Record field values (supports template variables)' })
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'RecordCreateAction',
    title: 'Record Create Action',
    description: 'Insert a new record into a table',
  })
)

export type RecordCreateAction = Schema.Schema.Type<typeof RecordCreateActionSchema>
