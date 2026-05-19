/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const RecordBatchCreateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record'),
  operator: Schema.Literal('batchCreate'),
  props: Schema.Struct({
    table: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Table to create records in' })
    ),

    items: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description:
            'Template variable referencing an array of record data objects (e.g., "{{transform.result}}")',
        })
      )
    ),

    records: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description:
            'Template variable referencing an array of record data objects (alias of `items`)',
        })
      )
    ),

    batchSize: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 1000),
        Schema.annotations({
          description: 'Records per batch (1-1000, default: 100)',
        })
      )
    ),

    continueOnItemError: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({
          description: 'Continue processing remaining items if one fails (default: false)',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'RecordBatchCreateAction',
    title: 'Record Batch Create Action',
    description: 'Create multiple records in a single operation',
  })
)

export type RecordBatchCreateAction = Schema.Schema.Type<typeof RecordBatchCreateActionSchema>
