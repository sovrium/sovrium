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
  type: Schema.Literal('file').pipe(
    Schema.annotate({
      description: "Constant value 'file' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('upload').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'file' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Source data for the upload */
    source: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Previous step result key, URL, or base64 data',
      })
    ),

    /** Storage key destination */
    path: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Storage key destination. If omitted, auto-generated.',
        })
      )
    ),

    /** MIME type */
    contentType: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'MIME type. If omitted, auto-detected from filename.',
        })
      )
    ),
  }).annotate({
    description: 'The file to store, the path it is stored under, and its content type.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'FileUploadAction',
    title: 'File Upload Action',
    description: 'Upload a file to storage from binary data, URL, or previous step output',
  })
)

/** @public */
export type FileUploadAction = Schema.Schema.Type<typeof FileUploadActionSchema>
