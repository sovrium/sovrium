/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PermissionValueSchema } from '@/domain/models/shared/permissions'


export const BucketPermissionsSchema = Schema.Struct({
  upload: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can upload files to this bucket' })
    )
  ),

  download: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can download files from this bucket' })
    )
  ),

  sign: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can generate signed download URLs' })
    )
  ),

  signUpload: Schema.optional(
    PermissionValueSchema.pipe(
      Schema.annotations({ description: 'Who can generate signed upload URLs' })
    )
  ),

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

export type BucketPermissions = Schema.Schema.Type<typeof BucketPermissionsSchema>
