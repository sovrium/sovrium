/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const FileListActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('list'),
  props: Schema.Struct({
    prefix: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Storage key prefix to list files under',
      })
    ),

    limit: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.int(),
        Schema.annotations({
          description: 'Maximum number of files to return',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'FileListAction',
    title: 'File List Action',
    description: 'List files in storage by key prefix',
  })
)

export type FileListAction = Schema.Schema.Type<typeof FileListActionSchema>
