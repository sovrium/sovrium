/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'
import { bucketFileItemSchema } from './files'

export const bucketFileUploadResponseSchema = z
  .object({
    success: z
      .literal(true)
      .describe(
        'Discriminant — always `true` on the 201 success response. Lets the admin dialog branch on outcome the same way it does for the public upload route.'
      ),
    file: bucketFileItemSchema.describe(
      'The created file, as the SAME flat projection a `GET /api/admin/buckets/:bucketName/files` row carries (`{ key, filename, size, mimeType, createdAt }`). Sourced from the just-written `system.file_storage_metadata` row so the browser sees the canonical, list-consistent shape.'
    ),
  })
  .openapi('BucketFileUploadResponse')

export type BucketFileUploadResponse = z.infer<typeof bucketFileUploadResponseSchema>
