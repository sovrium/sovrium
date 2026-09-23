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
 * Data Limit Action (type: data, operator: limit)
 *
 * Truncate an array to the first N items.
 */
export const DataLimitActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data').pipe(
    Schema.annotate({
      description: "Constant value 'data' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('limit').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'data' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Template reference to the array of items */
    input: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Template reference to the array of items' })
    ),

    /** Maximum number of items to keep (positive integer) */
    count: Schema.Finite.pipe(
      Schema.annotate({ description: 'Maximum number of items to keep (positive integer)' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    ),
  }).annotate({
    description: 'The list to shorten, and how many entries to keep.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'DataLimitAction',
    title: 'Data Limit Action',
    description: 'Truncate an array to the first N items',
  })
)

/** @public */
export type DataLimitAction = Schema.Schema.Type<typeof DataLimitActionSchema>
