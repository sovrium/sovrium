/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const DataMergeActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data'),
  operator: Schema.Literal('merge'),
  props: Schema.Struct({
    left: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Template reference to the first (left) array' })
    ),

    right: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Template reference to the second (right) array' })
    ),

    joinKey: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Shared field to join on — when omitted, the arrays are concatenated',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'DataMergeAction',
    title: 'Data Merge Action',
    description: 'Concatenate two arrays, or join them on a shared key',
  })
)

export type DataMergeAction = Schema.Schema.Type<typeof DataMergeActionSchema>
