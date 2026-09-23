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
 * Record Batch Create Action (type: record, operator: batchCreate)
 *
 * Create multiple records in a single operation.
 * The `items` prop references a template variable resolving to an array of data objects.
 */
export const RecordBatchCreateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('record').pipe(
    Schema.annotate({
      description: "Constant value 'record' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('batchCreate').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'record' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Target table name */
    table: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Table to create records in' })
    ),

    /** Template variable referencing an array of data objects */
    items: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Template variable referencing an array of record data objects (e.g., "{{transform.result}}")',
        })
      )
    ),

    /** Template variable referencing an array of data objects (alias of `items`) */
    records: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Template variable referencing an array of record data objects (alias of `items`)',
        })
      )
    ),

    /** Continue creating remaining records if one fails */
    continueOnItemError: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          defaultNote: 'false',
          description: 'Continue processing remaining items if one fails (default: false)',
        })
      )
    ),
  }).annotate({
    description: 'The table, and the records to insert in one go.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'RecordBatchCreateAction',
    title: 'Record Batch Create Action',
    description: 'Create multiple records in a single operation',
  })
)

/** @public */
export type RecordBatchCreateAction = Schema.Schema.Type<typeof RecordBatchCreateActionSchema>
