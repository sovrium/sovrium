/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const FileSignUrlActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('signUrl'),
  props: Schema.Struct({
    key: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Storage key of the file',
      })
    ),

    expiresIn: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({
          description: 'URL expiration time in seconds (default: 3600)',
        })
      )
    ),

    operation: Schema.optional(
      Schema.Literal('download', 'upload').pipe(
        Schema.annotations({
          description: 'URL operation type (default: download)',
        })
      )
    ),

    contentType: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: "Content type to bind to an upload URL (operation: 'upload')",
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'FileSignUrlAction',
    title: 'File Sign URL Action',
    description: 'Generate a time-limited signed URL for file access',
  })
)

export type FileSignUrlAction = Schema.Schema.Type<typeof FileSignUrlActionSchema>
