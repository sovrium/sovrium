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
 * Data Compare Action (type: data, operator: compare)
 *
 * Diff two arrays by a shared key field, producing `added`, `removed`, and
 * `unchanged` buckets. Useful for sync automations detecting changes between
 * data snapshots.
 */
export const DataCompareActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data'),
  operator: Schema.Literal('compare'),
  props: Schema.Struct({
    /** Template reference to the baseline (left) dataset */
    left: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Template reference to the baseline (left) dataset' })
    ),

    /** Template reference to the current (right) dataset */
    right: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Template reference to the current (right) dataset' })
    ),

    /** Unique identifier field for matching items across the two datasets */
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

/** @public */
export type DataCompareAction = Schema.Schema.Type<typeof DataCompareActionSchema>
