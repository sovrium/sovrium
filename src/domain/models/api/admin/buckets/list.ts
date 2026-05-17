/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/buckets`.
 *
 * Phase-0 admin list endpoint that enumerates the storage buckets configured
 * for this Sovrium instance, augmented with the canonical `_admin` envelope.
 * Greenfield list (no public counterpart at the bucket-listing level), but
 * paired with a sibling reshape (`/api/admin/buckets/quota` → `/overview`,
 * see `./overview.ts`) so the admin dashboard's storage tab can render the
 * full picture in two queries: list of buckets with per-bucket metadata,
 * plus an aggregate overview chart.
 *
 * Source story: docs/user-stories/as-business-admin/buckets/buckets-list.md
 *
 * **Why a list endpoint when Sovrium today has one default bucket** (the
 * "default" bucket served by `/api/buckets/default/files`): Phase 0 already
 * supports the three storage providers (`s3` | `local` | `bytea`) via env
 * vars and the bucket-naming layer is the seam where multi-bucket support
 * lands in Phase 1. Authoring the list endpoint now (a) locks the admin
 * shape early so multi-bucket can be additive, (b) lets the dashboard's
 * storage tab render a meaningful list-of-one without special-casing, and
 * (c) proves the helper's resource-type override path (the
 * `deriveResourceType` heuristic infers `bucket.list` from the action
 * `bucket.list.queried` — but the canonical resource type is `bucket`).
 *
 * @see plan-design §10 — story #5 in the authoring sequence
 * @see plan-design §6.2 — public-superset list pattern
 * @see ./overview.ts — sibling reshape of `/quota` → `/overview`
 */

import { z } from '@hono/zod-openapi'
import { cursorPaginationQuerySchema, cursorPaginationResponseSchema } from '../../_shared'
import { adminEnvelopeSchema } from '../_shared/admin-envelope'

/**
 * Storage provider literal — mirrors the env-var-driven provider selection
 * documented in `src/domain/models/env/storage.ts`. The `disabled` value
 * surfaces in `/api/admin/storage/status` but never appears in
 * `/api/admin/buckets`: a bucket existing in the list implies a provider is
 * configured (no provider = empty list, never a row with `provider:
 * disabled`).
 */
export const bucketProviderSchema = z
  .enum(['s3', 'local', 'bytea'])
  .describe('Active storage provider backing this bucket. Mirrors env-var-driven selection.')

/**
 * Public-grade bucket schema. This is what a non-admin reader would
 * theoretically see if Sovrium ever exposed a public `/api/buckets` listing
 * endpoint (none exists today — buckets are accessed via slug-by-slug
 * routes such as `/api/buckets/default/files`). Defining it here as the
 * "public superset" base lets us extend it with `_admin` per design §6.2.
 *
 * Field selection follows the principle of least surprise: an operator
 * looking at the dashboard expects to see the bucket's identity, its
 * provider, the optional region (S3 only — null for local/bytea), and the
 * lifecycle timestamps. Per-bucket usage stats (file count, total bytes)
 * live in `_admin.metadata` because they are admin-only and computed (not
 * persisted on the bucket row).
 */
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

/**
 * Admin list-item schema: `bucketSchema` extended with the canonical
 * `_admin` envelope. The envelope's `metadata` is narrowed to the
 * domain-specific shape `{ fileCount, totalBytes }` so the dashboard can
 * render storage-tab badges without a second query.
 *
 * Per design §10 D3 (locked): `_admin.metadata` is **optional at the
 * schema level** (so other domains that have no extras keep the canonical
 * block stable), but in this domain implementations MUST populate it. The
 * `bucketsListResponseSchema` does not require it via `.refine()` because
 * the runtime contract is "always populated when the projection succeeds";
 * a future refactor that splits the projection into a slow-path may emit
 * the bucket list without `metadata` and that is still schema-valid (the
 * dashboard would degrade by hiding the badges).
 */
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

/**
 * Query schema for `GET /api/admin/buckets`.
 *
 * Extends the canonical cursor pagination contract with two filter knobs:
 *
 * - `provider` — narrows the list to a single provider. Useful when the
 *   operator is debugging a provider-specific issue (e.g. "list every S3
 *   bucket so I can verify region drift").
 * - `include_deleted` — surfaces soft-deleted buckets. Default `false` —
 *   the dashboard's primary view shows live buckets only; toggling
 *   `?include_deleted=true` reveals tombstones for compliance review.
 *
 * **Coercion**: `include_deleted` uses `z.coerce.boolean()` because URL
 * query parameters arrive as strings. `z.coerce.boolean()` accepts `"true"`
 * / `"false"` / `"1"` / `"0"` and any non-empty string is truthy by Zod's
 * coercion rules — handlers should validate via this schema rather than
 * hand-parsing.
 */
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

/**
 * Response schema for `GET /api/admin/buckets`. Cursor-paginated list of
 * `bucketAdminItemSchema`.
 */
export const bucketsListResponseSchema =
  cursorPaginationResponseSchema(bucketAdminItemSchema).openapi('BucketsListResponse')

/**
 * TypeScript types inferred from the schemas.
 * @public
 */
export type BucketProvider = z.infer<typeof bucketProviderSchema>
/** @public */
export type Bucket = z.infer<typeof bucketSchema>
export type BucketAdminItem = z.infer<typeof bucketAdminItemSchema>
/** @public */
export type BucketsListQuery = z.infer<typeof bucketsListQuerySchema>
/** @public */
export type BucketsListResponse = z.infer<typeof bucketsListResponseSchema>
