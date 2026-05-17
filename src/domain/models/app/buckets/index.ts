/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BucketSchema } from './bucket'

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
  Schema.filter((buckets) => {
    // Check for duplicate bucket names
    const names = buckets.map((b) => b.name)
    const uniqueNames = new Set(names)
    if (uniqueNames.size !== names.length) {
      const duplicates = names.filter((name, i) => names.indexOf(name) !== i)
      return `Duplicate bucket names: ${duplicates.join(', ')}`
    }

    return undefined
  }),
  Schema.annotations({
    identifier: 'Buckets',
    title: 'Buckets',
    description:
      'Array of named storage buckets. Each bucket has its own permissions, file constraints, and public/private toggle.',
  })
)

export type Buckets = Schema.Schema.Type<typeof BucketsSchema>

// Re-export sub-modules
export { BucketSchema, BucketNameSchema, type Bucket, type BucketName } from './bucket'
export { BucketPermissionsSchema, type BucketPermissions } from './permissions'
