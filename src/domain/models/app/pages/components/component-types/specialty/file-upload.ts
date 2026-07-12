/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema, FetchSuccessResponseSchema, FetchToastResponseSchema } from '../../action'
import { actionFields } from '../modules/action'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const FileUploadTypeLiteral = Schema.Literal('file-upload')

export const FileUploadActionSchema = Schema.Union(Schema.String, ActionSchema).annotations({
  title: 'Upload Action',
  description:
    'Upload destination — either a URL string (e.g. "/api/buckets/default/files") or an Action object',
})

export const fileUploadFields = {
  ...coreFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  accept: Schema.optional(
    Schema.String.annotations({
      description: 'Accepted file types as MIME types or extensions (e.g. "image/*, .pdf")',
    })
  ),
  dropZone: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Enable drag-and-drop dropzone area for uploads',
    })
  ),
  maxFiles: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Maximum number of files allowed per upload' })
    )
  ),
  maxFileSize: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Maximum file size in bytes (e.g. 10485760 for 10MB)',
      })
    )
  ),
  uploadAction: Schema.optional(FileUploadActionSchema),
  onSuccess: Schema.optional(FetchSuccessResponseSchema),
  onError: Schema.optional(FetchToastResponseSchema),
} as const
