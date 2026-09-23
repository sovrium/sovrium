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
 * Data Merge Action (type: data, operator: merge)
 *
 * Combine two arrays. Without `joinKey`, the result is the concatenation of
 * both arrays. With `joinKey`, records from the right array are matched to
 * records in the left array on that shared field and merged into enriched
 * records.
 */
export const DataMergeActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data').pipe(
    Schema.annotate({
      description: "Constant value 'data' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('merge').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'data' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Template reference to the first (left) array */
    left: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Template reference to the first (left) array' })
    ),

    /** Template reference to the second (right) array */
    right: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Template reference to the second (right) array' })
    ),

    /** Shared field to join on — when omitted, the arrays are concatenated */
    joinKey: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Shared field to join on — when omitted, the arrays are concatenated',
        })
      )
    ),
  }).annotate({
    description: 'The two lists to join, and the key they are joined on.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'DataMergeAction',
    title: 'Data Merge Action',
    description: 'Concatenate two arrays, or join them on a shared key',
  })
)

/** @public */
export type DataMergeAction = Schema.Schema.Type<typeof DataMergeActionSchema>
