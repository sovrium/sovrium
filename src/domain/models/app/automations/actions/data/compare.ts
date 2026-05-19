/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const DataCompareActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data'),
  operator: Schema.Literal('compare'),
  props: Schema.Struct({
    left: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Template reference to the baseline (left) dataset' })
    ),

    right: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Template reference to the current (right) dataset' })
    ),

    key: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Unique identifier field for matching items across the two datasets',
      })
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'DataCompareAction',
    title: 'Data Compare Action',
    description: 'Diff two arrays by a shared key, returning added/removed/unchanged buckets',
  })
)

export type DataCompareAction = Schema.Schema.Type<typeof DataCompareActionSchema>
