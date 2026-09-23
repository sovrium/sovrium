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
 * Data Split Action (type: data, operator: split)
 *
 * Divide an array into chunks of the specified size. The final chunk may be
 * smaller than `size` when the array length is not an exact multiple.
 */
export const DataSplitActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data').pipe(
    Schema.annotate({
      description: "Constant value 'data' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('split').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'data' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Template reference to the array to chunk */
    input: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Template reference to the array to chunk' })
    ),

    /** Maximum size of each chunk (positive integer) */
    size: Schema.Finite.pipe(
      Schema.annotate({ description: 'Maximum size of each chunk (positive integer)' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    ),
  }).annotate({
    description: 'The list to cut into batches, and how large each batch is.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'DataSplitAction',
    title: 'Data Split Action',
    description: 'Divide an array into chunks of the specified size',
  })
)

/** @public */
export type DataSplitAction = Schema.Schema.Type<typeof DataSplitActionSchema>
