/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/buckets/:bucketName/files`.
 *
 * The bucket **file browser** read endpoint: a cursor-paginated, sortable,
 * mimeType-filterable enumeration of every stored file in a bucket, backed by
 * the `system.file_storage_metadata` projection (NOT the N+1
 * `StorageService.list('') + getMetadata(key)` walk the legacy basic handler
 * used). Powers the admin dashboard's `/_admin/data/buckets` file browser.
 *
 * Source story: [internal ref]
 *
 * **Why a sibling to list.ts and overview.ts**: the list endpoint
 * (`./list.ts`) is the bucket *index* — one row per bucket with aggregate
 * `_admin.metadata: { fileCount, totalBytes }` badges. The overview endpoint
 * (`./overview.ts`) is the aggregate *chart*. This endpoint is the *drill-in*:
 * once an operator clicks a bucket, they need to see the individual files —
 * which is a higher-volume read with its own cursor + sort + filter surface.
 * The three endpoints together compose the storage tab: index → chart →
 * file browser.
 *
 * **No `_admin` envelope** (unlike `./list.ts`): the `_admin` envelope
 * ([internal ref] D3) exists to make an admin endpoint a SUPERSET of a public
 * counterpart — it nests operator-only extras under `_admin` so the public and
 * admin shapes never drift. A stored file's metadata row has **no public
 * counterpart** (files are accessed by signed/scoped download routes, never
 * listed publicly), so there is nothing to be a superset of. The file item is
 * therefore a flat admin-only projection of the metadata row — no `_admin`,
 * no `deletedAt` (the `file_storage_metadata` table has no soft-delete column;
 * see the user story's "No soft-delete" note).
 *
 * @see ./list.ts — sibling bucket-index endpoint (uses the `_admin` envelope)
 * @see ./overview.ts — sibling aggregate-chart endpoint
 * @see ../../_shared/cursor-pagination.ts — opaque base64 cursor contract
 * @see ../audit-log/action-catalog.ts — `bucket.files.queried` (resource.type `bucket`)
 */

import { z } from '@hono/zod-openapi'
import { cursorPaginationQuerySchema, cursorPaginationResponseSchema } from '../../_shared'

/**
 * Sort key for the file browser. `date` orders by `createdAt`, `size` by the
 * byte `size`. Default `date` (the most recent uploads first is the operator's
 * default mental model when opening a bucket).
 *
 * The server seeks the next cursor page deterministically by the
 * `(<sortKey>, id)` tuple — `id` (the unique `file_storage_metadata.id`) is
 * the tie-breaker so two files with the same `createdAt` or `size` never
 * collapse into one cursor position.
 */
export const bucketFilesSortSchema = z
  .enum(['size', 'date'])
  .default('date')
  .describe(
    'File-browser sort key. `date` orders by `createdAt`; `size` by byte size. Default `date` (newest-first). Combined with `order`, drives the deterministic `(<sortKey>, id)` cursor seek.'
  )

/**
 * Sort direction. Default `desc` (newest / largest first), matching the
 * cursor-pagination convention of descending recency.
 */
export const bucketFilesOrderSchema = z
  .enum(['asc', 'desc'])
  .default('desc')
  .describe('Sort direction. Default `desc` (newest-first for `date`, largest-first for `size`).')

/**
 * A single file row in the browser. Flat projection of
 * `system.file_storage_metadata` — admin-only, no public counterpart, so no
 * `_admin` envelope (see file-level docstring).
 *
 * Field selection is the operator's at-a-glance triage set: the storage `key`
 * (the path segment used by the download route), the human `filename`, the
 * byte `size` (for the quota mental model), the `mimeType` (for the `type`
 * filter + an icon hint), and the `createdAt` upload timestamp.
 */
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

/**
 * Query schema for `GET /api/admin/buckets/:bucketName/files`.
 *
 * Extends the canonical cursor-pagination contract (`cursor`, `limit` —
 * default 50, max 200) with three file-browser knobs:
 *
 * - `sort` — `size` | `date` (default `date`). The column the page orders by
 *   (and the column the cursor seeks on).
 * - `order` — `asc` | `desc` (default `desc`).
 * - `type` — optional mimeType filter. Matches by **prefix** when the value
 *   ends in `/` (e.g. `image/` matches every image), or **exact** otherwise
 *   (e.g. `image/png` matches only PNGs). Empty / omitted = "all types".
 */
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

/**
 * Response schema for `GET /api/admin/buckets/:bucketName/files`.
 *
 * The canonical cursor-paginated envelope (`items`, `nextCursor`) **extended
 * with a sibling `totalBytes`** — the bucket's total stored bytes across ALL
 * files (not just the current page). Carried alongside the page so the file
 * browser's quota bar renders without a second round-trip to `/api/admin/buckets`
 * (per the user story's contract). `totalBytes` is invariant across pages —
 * paginating does not change the bucket total.
 */
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

/**
 * TypeScript types inferred from the schemas.
 * @public
 */
export type BucketFilesSort = z.infer<typeof bucketFilesSortSchema>
/** @public */
export type BucketFilesOrder = z.infer<typeof bucketFilesOrderSchema>
export type BucketFileItem = z.infer<typeof bucketFileItemSchema>
/** @public */
export type BucketFilesQuery = z.infer<typeof bucketFilesQuerySchema>
/** @public */
export type BucketFilesResponse = z.infer<typeof bucketFilesResponseSchema>
