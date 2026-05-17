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
 * File Upload Action (type: file, operator: upload)
 *
 * Upload a file to storage from binary data, URL, or previous step output.
 * The uploaded file is available as the step output for subsequent actions.
 */
export const FileUploadActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file'),
  operator: Schema.Literal('upload'),
  props: Schema.Struct({
    /** Source data for the upload */
    source: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Previous step result key, URL, or base64 data',
      })
    ),

    /** Storage key destination */
    path: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Storage key destination. If omitted, auto-generated.',
        })
      )
    ),

    /** MIME type */
    contentType: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'MIME type. If omitted, auto-detected from filename.',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'FileUploadAction',
    title: 'File Upload Action',
    description: 'Upload a file to storage from binary data, URL, or previous step output',
  })
)

/** @public */
export type FileUploadAction = Schema.Schema.Type<typeof FileUploadActionSchema>
