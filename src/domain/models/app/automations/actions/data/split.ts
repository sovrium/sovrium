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
  type: Schema.Literal('data'),
  operator: Schema.Literal('split'),
  props: Schema.Struct({
    /** Template reference to the array to chunk */
    input: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Template reference to the array to chunk' })
    ),

    /** Maximum size of each chunk (positive integer) */
    size: Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({ description: 'Maximum size of each chunk (positive integer)' })
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'DataSplitAction',
    title: 'Data Split Action',
    description: 'Divide an array into chunks of the specified size',
  })
)

/** @public */
export type DataSplitAction = Schema.Schema.Type<typeof DataSplitActionSchema>
