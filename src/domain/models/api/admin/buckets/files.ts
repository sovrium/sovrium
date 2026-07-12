/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'
import { cursorPaginationQuerySchema, cursorPaginationResponseSchema } from '../../_shared'

export const bucketFilesSortSchema = z
  .enum(['size', 'date'])
  .default('date')
  .describe(
    'File-browser sort key. `date` orders by `createdAt`; `size` by byte size. Default `date` (newest-first). Combined with `order`, drives the deterministic `(<sortKey>, id)` cursor seek.'
  )

export const bucketFilesOrderSchema = z
  .enum(['asc', 'desc'])
  .default('desc')
  .describe('Sort direction. Default `desc` (newest-first for `date`, largest-first for `size`).')

export const bucketFileItemSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .describe(
        'Unique storage key for this file (the `file_storage_metadata.key` column — the path segment used by the file download route). Stable across the file lifetime.'
      ),
    filename: z
      .string()
      .min(1)
      .describe('Original filename supplied at upload time (`file_storage_metadata.filename`).'),
    size: z
      .number()
      .int()
      .nonnegative()
      .describe('File size in bytes (`file_storage_metadata.size`).'),
    mimeType: z
      .string()
      .min(1)
      .describe(
        'MIME content type recorded at upload (`file_storage_metadata.mime_type`), e.g. `image/png`, `application/pdf`. Used by the `type` filter and the dashboard icon hint.'
      ),
    createdAt: z
      .string()
      .datetime()
      .describe('ISO 8601 UTC timestamp of the upload (`file_storage_metadata.created_at`).'),
  })
  .openapi('BucketFileItem')

export const bucketFilesQuerySchema = cursorPaginationQuerySchema.extend({
  sort: bucketFilesSortSchema,
  order: bucketFilesOrderSchema,
  type: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Optional mimeType filter. A trailing-slash value (`image/`) matches by prefix; a full type (`image/png`) matches exactly. Omit for "all types".'
    ),
})

export const bucketFilesResponseSchema = cursorPaginationResponseSchema(bucketFileItemSchema)
  .extend({
    totalBytes: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "Sum of all stored file sizes (bytes) in this bucket across every page — NOT just the current page. Lets the file browser render its quota bar without a second query to `/api/admin/buckets`. Invariant across pagination. Mirrors the bucket's `_admin.metadata.totalBytes` from the list endpoint."
      ),
  })
  .openapi('BucketFilesResponse')

export type BucketFilesSort = z.infer<typeof bucketFilesSortSchema>
export type BucketFilesOrder = z.infer<typeof bucketFilesOrderSchema>
export type BucketFileItem = z.infer<typeof bucketFileItemSchema>
export type BucketFilesQuery = z.infer<typeof bucketFilesQuerySchema>
export type BucketFilesResponse = z.infer<typeof bucketFilesResponseSchema>
