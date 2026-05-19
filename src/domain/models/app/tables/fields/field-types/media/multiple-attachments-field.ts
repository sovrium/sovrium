/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const MultipleAttachmentsFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('multiple-attachments'),
      bucket: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description:
              "Storage bucket name for this field's files. References a bucket in app.buckets.",
            examples: ['avatars', 'documents'],
          })
        )
      ),
      maxFiles: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(1),
          Schema.annotations({ description: 'Maximum number of files allowed' })
        )
      ),
      allowedFileTypes: Schema.optional(
        Schema.Array(Schema.String).pipe(
          Schema.annotations({
            description: 'Allowed MIME types for file uploads',
            examples: [['application/pdf', 'application/msword']],
          })
        )
      ),
      maxFileSize: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(1),
          Schema.annotations({
            description: 'Maximum file size in bytes per attachment',
            examples: [10_485_760],
          })
        )
      ),
      generateThumbnails: Schema.optional(
        Schema.Boolean.pipe(
          Schema.annotations({
            description: 'Whether to generate thumbnails for image attachments',
          })
        )
      ),
      storeMetadata: Schema.optional(
        Schema.Boolean.pipe(
          Schema.annotations({
            description: 'Whether to store metadata for each attachment',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Multiple Attachments Field',
    description:
      'Stores multiple file attachments. Storage backend configured globally via environment variables (see US-STORAGE-STORAGE-CONFIGURATION).',
    examples: [{ id: 1, name: 'documents', type: 'multiple-attachments', maxFiles: 10 }],
  })
)

export type MultipleAttachmentsField = Schema.Schema.Type<typeof MultipleAttachmentsFieldSchema>
