/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const FileCopyActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('copy'),
  props: Schema.Struct({
    sourceKey: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Storage key of the source file',
      })
    ),

    destinationKey: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Storage key for the copy',
      })
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'FileCopyAction',
    title: 'File Copy Action',
    description: 'Copy a file to a new storage path',
  })
)

export type FileCopyAction = Schema.Schema.Type<typeof FileCopyActionSchema>
