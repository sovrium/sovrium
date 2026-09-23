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
  type: Schema.Literal('record').pipe(
    Schema.annotate({
      description: "Constant value 'record' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('batchUpdate').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'record' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Target table name */
    table: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Table to update records in' })
    ),

    /** Template variable referencing an array of { filter, data } objects */
    items: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Template variable referencing an array of { filter, data } objects for batch updates',
      })
    ),

    /** Continue updating remaining records if one fails */
    continueOnItemError: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          defaultNote: 'false',
          description: 'Continue processing remaining items if one fails (default: false)',
        })
      )
    ),
  }).annotate({
    description: 'The table, and the changes applied to several records in one go.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'RecordBatchUpdateAction',
    title: 'Record Batch Update Action',
    description: 'Update multiple records in a single operation',
  })
)

/** @public */
export type RecordBatchUpdateAction = Schema.Schema.Type<typeof RecordBatchUpdateActionSchema>
