/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const FileMoveActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('move'),
  props: Schema.Struct({
    sourceKey: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Storage key of the file to move',
      })
    ),

    destinationKey: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'New storage key',
      })
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'FileMoveAction',
    title: 'File Move Action',
    description: 'Move a file to a new storage path (copy + delete original)',
  })
)

export type FileMoveAction = Schema.Schema.Type<typeof FileMoveActionSchema>
