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
  type: Schema.Literal('data').pipe(
    Schema.annotate({
      description: "Constant value 'data' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('compare').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'data' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Template reference to the baseline (left) dataset */
    left: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Template reference to the baseline (left) dataset' })
    ),

    /** Template reference to the current (right) dataset */
    right: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Template reference to the current (right) dataset' })
    ),

    /** Unique identifier field for matching items across the two datasets */
    key: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Unique identifier field for matching items across the two datasets',
      })
    ),
  }).annotate({
    description: 'The two lists to compare, and the key that pairs their entries up.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'DataCompareAction',
    title: 'Data Compare Action',
    description: 'Diff two arrays by a shared key, returning added/removed/unchanged buckets',
  })
)

/** @public */
export type DataCompareAction = Schema.Schema.Type<typeof DataCompareActionSchema>
