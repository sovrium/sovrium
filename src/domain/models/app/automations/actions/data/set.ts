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
 * Data Set Action (type: data, operator: set)
 *
 * Compute a value from a template expression and surface it for downstream
 * actions as `steps.<name>.value`. The n8n "Set / Edit Fields" equivalent.
 */
export const DataSetActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data').pipe(
    Schema.annotate({
      description: "Constant value 'data' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('set').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'data' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Value to compute and expose as `steps.<name>.value` (supports templates) */
    value: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Value to compute and expose as steps.<name>.value (supports templates)',
      })
    ),
  }).annotate({
    description: 'The value to store for later steps to read.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'DataSetAction',
    title: 'Data Set Action',
    description: 'Compute a value and expose it for downstream actions',
  })
)

/** @public */
export type DataSetAction = Schema.Schema.Type<typeof DataSetActionSchema>
