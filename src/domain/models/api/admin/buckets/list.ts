/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'
import { cursorPaginationQuerySchema, cursorPaginationResponseSchema } from '../../_shared'
import { adminEnvelopeSchema } from '../_shared/admin-envelope'

export const bucketProviderSchema = z
  .enum(['s3', 'local', 'bytea'])
  .describe('Active storage provider backing this bucket. Mirrors env-var-driven selection.')

export const bucketSchema = z
  .object({
    id: z.string().uuid().describe('Stable identifier for this bucket. UUIDv4.'),
    name: z
      .string()
      .min(1)
      .max(63)
      .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/)
      .describe(
        'URL-safe bucket slug. 1-63 chars, lowercase alphanumeric + hyphens, must start and end with an alphanumeric. Matches the path segment used in `/api/buckets/:name/files`.'
      ),
    provider: bucketProviderSchema,
    region: z
      .string()
      .nullable()
      .describe(
        'AWS region (S3 buckets only — for local and bytea providers this field is `null`).'
      ),
    createdAt: z.string().datetime().describe('ISO 8601 UTC timestamp of bucket creation.'),
    updatedAt: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp of the last bucket-level mutation (config change, region change, soft-delete). Independent of file uploads.'
      ),
  })
  .openapi('Bucket')

export const bucketAdminItemSchema = bucketSchema
  .extend({
    _admin: adminEnvelopeSchema
      .extend({
        metadata: z
          .object({
            fileCount: z
              .number()
              .int()
              .nonnegative()
              .describe(
                'Total number of stored files in this bucket (computed at projection time; not denormalised on the bucket row).'
              ),
            totalBytes: z
              .number()
              .int()
              .nonnegative()
              .describe(
                "Sum of stored file sizes in bytes for this bucket. Mirrors today's `/api/admin/buckets/quota.totalBytes` but per-bucket instead of global."
              ),
          })
          .describe(
            'Bucket-specific admin-only extras. Always populated for this domain; nested under `_admin.metadata` to avoid collision with the public schema.'
          ),
      })
      .describe('Canonical `_admin` envelope for the bucket list.'),
  })
  .openapi('BucketAdminItem')

export const bucketsListQuerySchema = cursorPaginationQuerySchema.extend({
  provider: bucketProviderSchema
    .optional()
    .describe('Optional provider filter. Omit for "all providers".'),
  include_deleted: z.coerce
    .boolean()
    .default(false)
    .describe(
      'When `true`, soft-deleted buckets are included in the response (with `_admin.deletedAt` populated). Default `false`.'
    ),
})

export const bucketsListResponseSchema =
  cursorPaginationResponseSchema(bucketAdminItemSchema).openapi('BucketsListResponse')

export type BucketProvider = z.infer<typeof bucketProviderSchema>
export type Bucket = z.infer<typeof bucketSchema>
export type BucketAdminItem = z.infer<typeof bucketAdminItemSchema>
export type BucketsListQuery = z.infer<typeof bucketsListQuerySchema>
export type BucketsListResponse = z.infer<typeof bucketsListResponseSchema>
