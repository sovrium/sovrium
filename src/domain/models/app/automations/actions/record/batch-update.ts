/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Record Batch Update Action (type: record, operator: batchUpdate)
 *
 * Update multiple records in a single operation.
 * The `items` prop references a template variable resolving to an array
 * of objects containing filter criteria and update data.
 */
export const RecordBatchUpdateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record'),
  operator: Schema.Literal('batchUpdate'),
  props: Schema.Struct({
    /** Target table name */
    table: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Table to update records in' })
    ),

    /** Template variable referencing an array of { filter, data } objects */
    items: TemplateStringSchema.pipe(
      Schema.annotations({
        description:
          'Template variable referencing an array of { filter, data } objects for batch updates',
      })
    ),

    /** Maximum records per batch operation */
    batchSize: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 1000),
        Schema.annotations({
          description: 'Records per batch (1-1000, default: 100)',
        })
      )
    ),

    /** Continue updating remaining records if one fails */
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
    identifier: 'RecordBatchUpdateAction',
    title: 'Record Batch Update Action',
    description: 'Update multiple records in a single operation',
  })
)

/** @public */
export type RecordBatchUpdateAction = Schema.Schema.Type<typeof RecordBatchUpdateActionSchema>
