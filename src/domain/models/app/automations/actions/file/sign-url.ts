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
  type: Schema.Literal('file').pipe(
    Schema.annotate({
      description: "Constant value 'file' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('signUrl').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'file' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Storage key of the file */
    key: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Storage key of the file',
      })
    ),

    /** URL expiration time in seconds */
    expiresIn: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'URL expiration time in seconds (default: 3600)',
        }),
        Schema.check(Schema.isGreaterThan(0))
      )
    ),

    /** URL operation type */
    operation: Schema.optional(
      Schema.Literals(['download', 'upload']).pipe(
        Schema.annotate({
          description: 'URL operation type (default: download)',
        })
      )
    ),

    /** Content type to bind to an upload URL (only used when operation is 'upload') */
    contentType: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: "Content type to bind to an upload URL (operation: 'upload')",
        })
      )
    ),
  }).annotate({
    description:
      'The file to sign a temporary link for, what the link allows, and how long it lasts.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'FileSignUrlAction',
    title: 'File Sign URL Action',
    description: 'Generate a time-limited signed URL for file access',
  })
)

/** @public */
export type FileSignUrlAction = Schema.Schema.Type<typeof FileSignUrlActionSchema>
