/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const MultipleAttachmentsFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('multiple-attachments').pipe(
      Schema.annotate({
        description:
          "Constant value 'multiple-attachments' for type discrimination in discriminated unions",
      })
    ),
    /** Storage bucket name for this field's files. References a bucket defined in app.buckets.
     *  When omitted, uses the implicit 'default' bucket. */
    bucket: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            "Storage bucket name for this field's files. References a bucket in app.buckets.",
          examples: ['avatars', 'documents'],
        })
      )
    ),
    maxFiles: Schema.optional(
      Schema.Int.pipe(
        Schema.annotate({ description: 'Maximum number of files allowed' }),
        Schema.check(Schema.isGreaterThanOrEqualTo(1))
      )
    ),
    allowedFileTypes: Schema.optional(
      Schema.Array(
        Schema.String.annotate({
          description: 'One allowed MIME type.',
          examples: ['image/png', 'application/pdf'],
        })
      ).pipe(
        Schema.annotate({
          description: 'Allowed MIME types for file uploads',
          examples: [['application/pdf', 'application/msword']],
        })
      )
    ),
    maxFileSize: Schema.optional(
      Schema.Int.pipe(
        Schema.annotate({
          description: 'Maximum file size in bytes per attachment',
          examples: [10_485_760],
        }),
        Schema.check(Schema.isGreaterThanOrEqualTo(1))
      )
    ),
    storeMetadata: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          description: 'Whether to store metadata for each attachment',
        })
      )
    ),
  }),
  Schema.annotate({
    title: 'Multiple Attachments Field',
    description:
      'Stores multiple file attachments. The storage backend is configured globally through STORAGE_* environment variables, not per field.',
    examples: [{ id: 1, name: 'documents', type: 'multiple-attachments', maxFiles: 10 }],
  })
)

/** @public */
export type MultipleAttachmentsField = Schema.Schema.Type<typeof MultipleAttachmentsFieldSchema>
