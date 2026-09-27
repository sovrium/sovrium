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
  Schema.annotate({
    title: 'Bucket Name',
    description:
      'Bucket name: lowercase, alphanumeric, hyphens. Must start with a letter. Max 63 characters.',
    examples: ['avatars', 'documents', 'public-assets', 'user-uploads'],
  }),
  Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/), Schema.isMaxLength(63))
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
 * A bucket is a declaration, not a storage location. Every bucket shares the
 * one backend the environment resolves (S3, local disk or the database), and
 * storage keys are flat: they carry no bucket prefix. What binds a stored file
 * to its bucket is the bucket recorded beside it, which is what the bucket's
 * permissions are checked against on every read and delete.
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
  /** Unique bucket name (kebab-case). `system` is reserved for the built-in System Bucket. */
  name: BucketNameSchema,

  /** Whether files in this bucket are publicly accessible without authentication.
   *  Defaults to false (private). Public buckets serve files without signed URLs. */
  public: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description:
          'Whether files are publicly accessible. Defaults to false (private). Public buckets serve files without signed URLs.',
      })
    )
  ),

  /** Maximum file size in bytes for uploads to this bucket.
   *  Overrides the global STORAGE_MAX_FILE_SIZE env var for this bucket. */
  maxFileSize: Schema.optional(
    Schema.Int.pipe(
      Schema.annotate({
        description: 'Maximum file size in bytes. Overrides global STORAGE_MAX_FILE_SIZE.',
        examples: [2_097_152, 10_485_760, 52_428_800],
      }),
      Schema.check(Schema.isGreaterThanOrEqualTo(1))
    )
  ),

  /** Allowed MIME types for uploads. Supports wildcards (e.g., 'image/*').
   *  When omitted, all file types are accepted. */
  allowedMimeTypes: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotate({
        description:
          "Allowed MIME types for uploads. Supports wildcards (e.g., 'image/*'). When omitted, all types accepted.",
        examples: [
          ['image/jpeg', 'image/png', 'image/webp'],
          ['application/pdf', 'text/csv'],
          ['image/*'],
        ],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /** Per-bucket permission configuration */
  permissions: Schema.optional(BucketPermissionsSchema),
}).pipe(
  Schema.annotate({
    identifier: 'Bucket',
    title: 'Bucket',
    description:
      'Named storage bucket with optional public/private toggle, file constraints, and permissions. Every bucket shares the one storage backend the environment configures; the bucket is recorded beside each file rather than encoded in its path.',
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
 * The name of the built-in System Bucket.
 *
 * Kept local to the schema on purpose: the runtime identity module owns the
 * constant the resolvers read, and the schema only needs to know which single
 * name it refuses. `default`, the bucket's former name, is an ordinary bucket
 * name again.
 */
const RESERVED_SYSTEM_BUCKET_NAME = 'system'

/**
 * Buckets Schema
 *
 * Array of named storage buckets. Validates:
 * - Bucket names are unique
 * - No bucket is named `system`, which is reserved for the built-in System Bucket
 *
 * Every app has the built-in System Bucket whether or not it declares any:
 * it is where attachment fields that name no `bucket:` store their files, and
 * the console lists it first as the view of every file linked to a record,
 * whichever bucket holds it. It is never declared, so a declaration named
 * `system` is refused rather than allowed to shadow it.
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
export const BucketsSchema = Schema.Array(BucketSchema)
  // Annotated BEFORE the checks: a description piped after a `makeFilter` check
  // never reaches the published JSON Schema, because the filter emits no node.
  .annotate({
    description:
      'Places uploaded files are kept, each with its own name, permissions, size and type limits, and public or private access. Every app also has the built-in `system` bucket, which it does not declare: attachment fields that name no bucket store their files there, and the console lists it first as the view of every file linked to a record. The name `system` is therefore reserved.',
  })
  .pipe(
    Schema.check(
      Schema.makeFilter((buckets) => {
        // The built-in System Bucket is never declared: a declaration named
        // `system` would shadow it, so the name is refused outright.
        if (buckets.some((b) => b.name === RESERVED_SYSTEM_BUCKET_NAME)) {
          return `Bucket name '${RESERVED_SYSTEM_BUCKET_NAME}' is reserved for the built-in System Bucket every app carries. Rename this bucket.`
        }

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
