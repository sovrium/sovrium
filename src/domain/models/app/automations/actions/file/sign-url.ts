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
 * File Sign URL Action (type: file, operator: signUrl)
 *
 * Generate a time-limited signed URL for file access.
 * The signed URL is available as the step output for subsequent actions.
 */
export const FileSignUrlActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('signUrl'),
  props: Schema.Struct({
    /** Storage key of the file */
    key: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Storage key of the file',
      })
    ),

    /** URL expiration time in seconds */
    expiresIn: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({
          description: 'URL expiration time in seconds (default: 3600)',
        })
      )
    ),

    /** URL operation type */
    operation: Schema.optional(
      Schema.Literal('download', 'upload').pipe(
        Schema.annotations({
          description: 'URL operation type (default: download)',
        })
      )
    ),

    /** Content type to bind to an upload URL (only used when operation is 'upload') */
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

/** @public */
export type FileSignUrlAction = Schema.Schema.Type<typeof FileSignUrlActionSchema>
