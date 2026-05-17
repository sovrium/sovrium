/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PermissionValueSchema } from '@/domain/models/shared/permissions'

// ---------------------------------------------------------------------------
// Bucket Permissions
// ---------------------------------------------------------------------------

/**
 * Bucket Permissions Schema
 *
 * Defines who can perform storage operations on a specific bucket.
 * Uses the shared PermissionValueSchema format: 'all' | 'authenticated' | string[].
 *
 * All fields are optional — defaults are applied at runtime:
 * - upload: 'authenticated'
 * - download: 'all' (if bucket is public), 'authenticated' (if private)
 * - sign: 'authenticated'
 * - signUpload: ['admin']
 * - delete: ['admin']
 *
 * @example
 * ```yaml
 * buckets:
 *   - name: documents
 *     permissions:
 *       upload: ['admin', 'editor']
 *       download: authenticated
 *       sign: authenticated
 *       signUpload: ['admin', 'editor']
 *       delete: ['admin']
 * ```
 */
export const BucketPermissionsSchema = Schema.Struct({
  /** Who can upload files to this bucket */
  upload: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can upload files to this bucket' })
    )
  ),

  /** Who can download files from this bucket */
  download: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can download files from this bucket' })
    )
  ),

  /** Who can generate signed download URLs for files in this bucket */
  sign: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can generate signed download URLs' })
    )
  ),

  /** Who can generate signed upload URLs for files in this bucket */
  signUpload: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can generate signed upload URLs' })
    )
  ),

  /** Who can delete files from this bucket */
  delete: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can delete files from this bucket' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'BucketPermissions',
    title: 'Bucket Permissions',
    description:
      'Per-bucket permission configuration. Uses the same format as table permissions: all, authenticated, or role array.',
  })
)

/** @public */
export type BucketPermissions = Schema.Schema.Type<typeof BucketPermissionsSchema>
