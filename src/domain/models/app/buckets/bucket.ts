/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BucketPermissionsSchema } from './permissions'


export const BucketNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/),
  Schema.maxLength(63),
  Schema.annotations({
    title: 'Bucket Name',
    description:
      'Bucket name: lowercase, alphanumeric, hyphens. Must start with a letter. Max 63 characters.',
    examples: ['avatars', 'documents', 'public-assets', 'user-uploads'],
  })
)

export type BucketName = Schema.Schema.Type<typeof BucketNameSchema>


export const BucketSchema = Schema.Struct({
  name: BucketNameSchema,

  public: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description:
          'Whether files are publicly accessible. Defaults to false (private). Public buckets serve files without signed URLs.',
      })
    )
  ),

  maxFileSize: Schema.optional(
    Schema.Int.pipe(
      Schema.greaterThanOrEqualTo(1),
      Schema.annotations({
        description: 'Maximum file size in bytes. Overrides global STORAGE_MAX_FILE_SIZE.',
        examples: [2_097_152, 10_485_760, 52_428_800],
      })
    )
  ),

  allowedMimeTypes: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description:
          "Allowed MIME types for uploads. Supports wildcards (e.g., 'image/*'). When omitted, all types accepted.",
        examples: [
          ['image/jpeg', 'image/png', 'image/webp'],
          ['application/pdf', 'text/csv'],
          ['image/*'],
        ],
      })
    )
  ),

  permissions: Schema.optional(BucketPermissionsSchema),
}).pipe(
  Schema.annotations({
    identifier: 'Bucket',
    title: 'Bucket',
    description:
      'Named storage bucket with optional public/private toggle, file constraints, and permissions. Buckets are path prefixes inside the S3 bucket configured via S3_BUCKET env var.',
    examples: [
      {
        name: 'avatars',
        public: true,
        maxFileSize: 2_097_152,
        allowedMimeTypes: ['image/jpeg', 'image/png'],
      },
      {
        name: 'documents',
        maxFileSize: 52_428_800,
        permissions: {
          upload: ['admin', 'editor'] as readonly string[],
          download: 'authenticated' as const,
          delete: ['admin'] as readonly string[],
        },
      },
    ],
  })
)

export type Bucket = Schema.Schema.Type<typeof BucketSchema>
