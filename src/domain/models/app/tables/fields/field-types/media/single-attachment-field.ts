/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const SingleAttachmentFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('single-attachment'),
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
    allowedFileTypes: Schema.optional(
      Schema.Array(Schema.String).pipe(
        Schema.annotate({
          description: 'Allowed MIME types for file uploads',
          examples: [['image/png', 'image/jpeg', 'image/gif']],
        })
      )
    ),
    maxFileSize: Schema.optional(
      Schema.Int.pipe(
        Schema.check(Schema.isGreaterThanOrEqualTo(1)),
        Schema.annotate({
          description: 'Maximum file size in bytes',
          examples: [5_242_880],
        })
      )
    ),
    storeMetadata: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          description: 'Whether to store metadata (dimensions for images, duration for videos)',
        })
      )
    ),
  }),
  Schema.annotate({
    title: 'Single Attachment Field',
    description:
      'Stores a single file attachment. The storage backend is configured globally through STORAGE_* environment variables, not per field.',
    examples: [
      {
        id: 1,
        name: 'profile_pic',
        type: 'single-attachment',
        maxFileSize: 5_242_880,
      },
    ],
  })
)

/** @public */
export type SingleAttachmentField = Schema.Schema.Type<typeof SingleAttachmentFieldSchema>
