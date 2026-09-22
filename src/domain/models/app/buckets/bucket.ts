/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BucketPermissionsSchema } from './permissions'

// ---------------------------------------------------------------------------
// Bucket Name
// ---------------------------------------------------------------------------

/**
 * Bucket Name Schema
 *
 * Validates bucket naming convention: lowercase, alphanumeric, hyphens allowed.
 * Must start with a letter. Max 63 characters (S3 path prefix compatibility).
 *
 * @example
 * ```typescript
 * 'avatars'        // valid
 * 'public-assets'  // valid
 * 'user-uploads'   // valid
 * 'Avatars'        // invalid (uppercase)
 * '123-bucket'     // invalid (starts with number)
 * ```
 */
export const BucketNameSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/), Schema.isMaxLength(63)),
  Schema.annotate({
    title: 'Bucket Name',
    description:
      'Bucket name: lowercase, alphanumeric, hyphens. Must start with a letter. Max 63 characters.',
    examples: ['avatars', 'documents', 'public-assets', 'user-uploads'],
  })
)

/** @public */
export type BucketName = Schema.Schema.Type<typeof BucketNameSchema>

// ---------------------------------------------------------------------------
// Bucket Schema
// ---------------------------------------------------------------------------

/**
 * Bucket Schema
 *
 * Defines a named storage bucket with optional public/private toggle,
 * file constraints, and per-bucket permissions.
 *
 * Buckets are mapped to path prefixes inside the S3 bucket configured
 * via the `STORAGE_S3_BUCKET` env var (e.g., `s3://my-app-files/avatars/`).
 *
 * @example
 * ```yaml
 * buckets:
 *   - name: avatars
 *     public: true
 *     maxFileSize: 2097152
 *     allowedMimeTypes:
 *       - image/jpeg
 *       - image/png
 *     permissions:
 *       upload: authenticated
 *       download: all
 *       delete: ['admin']
 *
 *   - name: documents
 *     maxFileSize: 52428800
 *     allowedMimeTypes:
 *       - application/pdf
 *     permissions:
 *       upload: ['admin', 'editor']
 *       download: authenticated
 *       delete: ['admin']
 * ```
 */
export const BucketSchema = Schema.Struct({
  /** Unique bucket name (kebab-case, used as storage path prefix) */
  name: BucketNameSchema,

  /** Whether files in this bucket are publicly accessible without authentication.
   *  Defaults to false (private). Public buckets serve files without signed URLs. */
  public: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        description:
          'Whether files are publicly accessible. Defaults to false (private). Public buckets serve files without signed URLs.',
      })
    )
  ),

  /** Maximum file size in bytes for uploads to this bucket.
   *  Overrides the global STORAGE_MAX_FILE_SIZE env var for this bucket. */
  maxFileSize: Schema.optional(
    Schema.Int.pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(1)),
      Schema.annotate({
        description: 'Maximum file size in bytes. Overrides global STORAGE_MAX_FILE_SIZE.',
        examples: [2_097_152, 10_485_760, 52_428_800],
      })
    )
  ),

  /** Allowed MIME types for uploads. Supports wildcards (e.g., 'image/*').
   *  When omitted, all file types are accepted. */
  allowedMimeTypes: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
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

  /** Per-bucket permission configuration */
  permissions: Schema.optional(BucketPermissionsSchema),
}).pipe(
  Schema.annotate({
    identifier: 'Bucket',
    title: 'Bucket',
    description:
      'Named storage bucket with optional public/private toggle, file constraints, and permissions. Buckets are path prefixes inside the S3 bucket configured via STORAGE_S3_BUCKET env var.',
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

// ---------------------------------------------------------------------------
// Buckets Array Schema
// ---------------------------------------------------------------------------

/**
 * Buckets Schema
 *
 * Array of named storage buckets. Validates:
 * - Bucket names are unique
 *
 * When omitted from the app schema, an implicit 'default' bucket is used
 * at runtime with `public: false` and standard permission defaults.
 *
 * @example
 * ```yaml
 * buckets:
 *   - name: avatars
 *     public: true
 *     maxFileSize: 2097152
 *     allowedMimeTypes: [image/jpeg, image/png]
 *
 *   - name: documents
 *     maxFileSize: 52428800
 *     permissions:
 *       upload: ['admin', 'editor']
 *       download: authenticated
 *       delete: ['admin']
 * ```
 */
export const BucketsSchema = Schema.Array(BucketSchema).pipe(
  Schema.check(
    Schema.makeFilter((buckets) => {
      // Check for duplicate bucket names
      const names = buckets.map((b) => b.name)
      const uniqueNames = new Set(names)
      if (uniqueNames.size !== names.length) {
        const duplicates = names.filter((name, i) => names.indexOf(name) !== i)
        return `Duplicate bucket names: ${duplicates.join(', ')}`
      }

      return undefined
    })
  ),
  Schema.annotate({
    identifier: 'Buckets',
    title: 'Buckets',
    description:
      'Array of named storage buckets. Each bucket has its own permissions, file constraints, and public/private toggle.',
  })
)

export type Buckets = Schema.Schema.Type<typeof BucketsSchema>
