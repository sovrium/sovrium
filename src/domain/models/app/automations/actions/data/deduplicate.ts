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
 * Data Deduplicate Action (type: data, operator: deduplicate)
 *
 * Remove duplicate items from an array based on a specified key field; the
 * first occurrence of each key is kept.
 */
export const DataDeduplicateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data').pipe(
    Schema.annotate({
      description: "Constant value 'data' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('deduplicate').pipe(
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

    /** Field whose value identifies duplicates */
    key: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Field whose value identifies duplicates' })
    ),
  }).annotate({
    description: 'The list to clean up, and the key on which entries count as duplicates.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'DataDeduplicateAction',
    title: 'Data Deduplicate Action',
    description: 'Remove duplicate items from an array based on a specified key field',
  })
)

/** @public */
export type DataDeduplicateAction = Schema.Schema.Type<typeof DataDeduplicateActionSchema>
