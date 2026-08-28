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
import {
  appliedQuerySchema,
  cursorPaginationQuerySchema,
  cursorPaginationResponseSchema,
  searchTermSchema,
} from '../../_shared'

/**
 * Sort key for the file browser — one per COLUMN the browser renders.
 *
 * The keys ARE the column field names (`filename` | `mimeType` | `size` |
 * `createdAt`), and that identity is the contract. The grid declares four
 * sortable columns and serialises a header click as `?sort=<field>:<direction>`,
 * so a key the enum does not carry answers 400 where the operator asked for an
 * ordering. Three of the four did exactly that for as long as the enum spelled
 * its date key `date` while the column spelled the same thing `createdAt` — a
 * vocabulary disagreeing with itself. Adding a column to the browser means
 * adding its field here AND to `sortColumnExpression` in the repository.
 *
 * Default `createdAt` (newest uploads first is the operator's mental model on
 * opening a bucket) — the same ordering the old `date` default produced,
 * re-spelled rather than re-pointed. `date` is still ACCEPTED, as a legacy alias
 * normalised away before it reaches this enum, so exactly one spelling exists
 * downstream of the route (see {@link normalizeBucketFilesSortKey}).
 *
 * The server seeks the next cursor page deterministically by the
 * `(<sortKey>, id)` tuple — `id` (the unique `file_storage_metadata.id`) is
 * the tie-breaker, so two files with the same `createdAt`, `size` or folded name
 * never collapse into one cursor position.
 */
export const bucketFilesSortSchema = z
  .enum(['filename', 'mimeType', 'size', 'createdAt'])
  .default('createdAt')
  .describe(
    'File-browser sort key — one per rendered column: `filename`, `mimeType`, `size`, `createdAt`. Default `createdAt` (newest-first). The legacy spelling `date` is accepted as an alias of `createdAt`. The two string keys order case-insensitively, identically on both engines. Combined with `order`, drives the deterministic `(<sortKey>, id)` cursor seek.'
  )

/**
 * Legacy sort spellings still accepted, mapped to their canonical column name.
 *
 * `date` predates the four-column vocabulary and is the spelling this endpoint's
 * own older specs document, so retiring it would break operator bookmarks for no
 * gain. It is an ALIAS and not a peer: it is rewritten to `createdAt` before
 * validation, which is what makes the two spellings provably ONE sort rather
 * than two that merely both answer 200. Two independent spellings of one column
 * is precisely the drift that produced the defect this vocabulary closes.
 */
const BUCKET_FILES_SORT_ALIASES: Readonly<Record<string, string>> = { date: 'createdAt' }

/**
 * Rewrite a legacy sort key to its canonical column name; leave anything else
 * exactly as it arrived.
 *
 * Deliberately NOT a widening. An unknown key passes through untouched and then
 * fails {@link bucketFilesSortSchema}, so it still answers 400 rather than being
 * served in whatever order the store happened to yield: widening what can be
 * SPELLED must not widen what can be SERVED.
 */
export function normalizeBucketFilesSortKey(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  return BUCKET_FILES_SORT_ALIASES[raw] ?? raw
}

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
 * - `q` — optional free-text search over `filename` and `key` (see below).
 *
 * ## What `q` searches here, and what it deliberately does not
 *
 * `filename` is what the operator reads in the browser; `key` is the storage
 * path segment they may have pasted from a download URL or a log line. Both are
 * matched as a case-insensitive substring.
 *
 * `mimeType` is deliberately EXCLUDED. It already has a precise filter of its
 * own (`type`), and folding it into free text would make `?q=png` return every
 * PNG in the bucket — drowning the one file the operator was actually looking
 * for under a category match they did not ask for. The two knobs compose with
 * AND instead: `?type=image/&q=logo` is "images whose name contains logo".
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
  q: searchTermSchema.describe(
    'Optional free-text search over the file `filename` and storage `key`, as a case-insensitive literal substring. Composes with `type` (AND) and with the cursor, so the page is a page of MATCHES. `mimeType` is intentionally not searched — use `type` for that. Empty / whitespace-only means "no search".'
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
        "Sum of all stored file sizes (bytes) in this bucket across every page — NOT just the current page, and NOT narrowed by `type` or `q`. Lets the file browser render its quota bar without a second query to `/api/admin/buckets`. Invariant across pagination AND across filtering: the quota bar answers 'how full is this bucket', which a search does not change. Mirrors the bucket's `_admin.metadata.totalBytes` from the list endpoint."
      ),
    appliedQuery: appliedQuerySchema,
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
