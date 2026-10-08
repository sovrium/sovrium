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
        description:
          'Storage key of the file. The link opens whatever file this names, so never build it from trigger, webhook or request values; take it from a record the run has already read',
      })
    ),

    /** URL expiration time in seconds */
    expiresIn: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description:
            'URL expiration time in seconds (default: 3600), held between 60 seconds and 7 days. Anyone holding the link can use it until then, so keep it as short as the recipient needs',
        }),
        Schema.check(Schema.isGreaterThan(0))
      )
    ),

    /** URL operation type */
    operation: Schema.optional(
      Schema.Literals(['download', 'upload']).pipe(
        Schema.annotate({
          description:
            'URL operation type (default: download). An upload URL points at the app and writes a new file into the private `system` bucket; a key that already holds a file is refused',
        })
      )
    ),

    /** Content type to bind to an upload URL (only used when operation is 'upload') */
    contentType: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            "Content type an upload URL accepts (operation: 'upload'); an upload of any other type is refused. Ignored for a download",
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
