/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Admin Bucket Files Repository Port
 *
 * Type-safe data access backing the bucket **file browser** read endpoint
 * (`GET /api/admin/buckets/:bucketName/files`). Two reads over
 * `system.file_storage_metadata`:
 *
 *   - {@link listFiles} — a cursor-paginated, sortable, mimeType-filterable scan
 *     of the file-metadata rows. Sort + cursor seek deterministically on the
 *     `(<sortKey>, id)` tuple — one key per rendered column — so two files with
 *     the same timestamp, size or folded name never collapse into one cursor
 *     position.
 *   - {@link sumTotalBytes} — `SUM(size)` across the entire bucket, invariant
 *     across both the `type` filter and pagination (the file-browser quota bar
 *     renders the bucket total, not the current page's sum).
 *   - {@link listUploadsSince} — the `{ size, createdAt }` pairs for files stored
 *     on/after a date, backing the storage overview's upload series.
 *
 * This is a deliberately separate port (not folded into a storage-service
 * abstraction): the file browser needs raw metadata rows (key, filename, size,
 * mimeType, createdAt, id) with cursor pagination and a sort/filter WHERE
 * contract — none of which the `StorageService` capability port exposes. Same
 * judgement cluster applied for the admin-forms vs the form-submission write
 * port.
 *
 * The row + filter types below are decoupled from Drizzle so the application
 * layer stays free of an infrastructure dependency. Implementation lives in the
 * infrastructure layer (admin-bucket-files-repository-live.ts).
 */

/**
 * Database error for admin-bucket-files read operations.
 */
export class AdminBucketFilesDatabaseError extends Data.TaggedError(
  'AdminBucketFilesDatabaseError'
)<{
  readonly cause: unknown
}> {}

/**
 * Raw file-metadata row used by the file browser. Mirrors the
 * `file_storage_metadata` projection — `createdAt` stays dialect-native
 * (`Date | string`: Postgres returns `Date`, SQLite a number/Date depending on
 * the driver) so the use case owns ISO normalization. `size` is the byte count.
 * `id` is the unique row id used as the cursor tie-breaker.
 */
export interface AdminBucketFileRow {
  readonly id: string
  readonly key: string
  readonly filename: string
  readonly mimeType: string
  readonly size: number
  readonly createdAt: Date | string
}

/**
 * A stored file reduced to what the overview's upload series needs: its byte
 * size and when it was stored. `createdAt` stays dialect-native (`Date | string
 * | number`) so the use case owns the epoch coercion, exactly as
 * {@link AdminBucketFileRow} does.
 */
export interface AdminBucketUploadRow {
  readonly size: number
  readonly createdAt: Date | string | number
}

/**
 * Resolved WHERE / ORDER inputs for the file-list reader. The use case parses +
 * validates the raw query string (and decodes the opaque cursor) into this
 * shape; the repository turns it into dialect-aware drizzle predicates.
 *
 * - `sort` — the column the page orders + the cursor seeks on, one per rendered
 *   browser column. Already canonical here: the route rewrites the legacy `date`
 *   spelling to `createdAt` before this shape is built, so the repository never
 *   sees two names for one column. The two string keys order case-insensitively
 *   (`lower()`), which is the only ordering the two engines agree on, and
 *   `filename` orders by the DISPLAYED name — the stored value carries a random
 *   `<uuid>-` prefix that would otherwise decide the sequence.
 * - `order` — `asc` | `desc`.
 * - `typePrefix` — when set, a `LIKE '<prefix>%'` mimeType filter (the use case
 *   resolves a trailing-slash value into a prefix; an exact value becomes a
 *   single-element prefix that LIKE-matches itself).
 * - `typeExact` — when set, an exact `=` mimeType filter (mutually exclusive
 *   with `typePrefix`).
 * - `q` — when set, a case-insensitive literal-substring match over `filename`
 *   OR `key`. AND-ed with the type filter and the cursor seek, so the overfetch
 *   runs over the MATCHES and a page is a page of matches rather than of
 *   whatever rows were newest. Absent means "no search", never "match nothing".
 * - `cursor` — the decoded `(value, id)` tuple from the opaque cursor; the
 *   repository emits the dialect-aware seek predicate for it.
 * - `limit` — the page size; the repository fetches `limit + 1` rows so the use
 *   case can compute `hasMore` / `nextCursor`.
 */
export interface AdminBucketFilesListFilters {
  readonly sort: 'filename' | 'mimeType' | 'size' | 'createdAt'
  readonly order: 'asc' | 'desc'
  readonly typePrefix?: string | undefined
  readonly typeExact?: string | undefined
  readonly q?: string | undefined
  readonly cursor?: { readonly value: string; readonly id: string } | undefined
  readonly limit: number
}

export class AdminBucketFilesRepository extends Context.Service<
  AdminBucketFilesRepository,
  {
    /**
     * Cursor-paginated file-metadata read. Fetches `filters.limit + 1` rows
     * ordered by the `(<sortKey>, id)` tuple in the requested direction,
     * applying the optional mimeType filter immutably. The extra row lets the
     * use case derive `hasMore` / `nextCursor`.
     */
    readonly listFiles: (
      filters: AdminBucketFilesListFilters
    ) => Effect.Effect<readonly AdminBucketFileRow[], AdminBucketFilesDatabaseError>

    /**
     * `SUM(size)` across every file-metadata row in the bucket. Invariant
     * across the `type` filter and pagination — backs the file browser's quota
     * bar (`totalBytes`).
     */
    readonly sumTotalBytes: Effect.Effect<number, AdminBucketFilesDatabaseError>

    /**
     * The `{ size, createdAt }` pairs for every file stored on/after `since`.
     * Backs the storage overview's `series` buckets.
     *
     * The storage catalog is the only complete, sized, timestamped record of
     * what is stored: `size` is NOT NULL and `created_at` is NOT NULL, and every
     * provider writes a row on every upload path. The audit log cannot serve
     * here — its `bucket.file.uploaded` entries carry no byte size, and the
     * public upload route emits none at all.
     *
     * Rows are hard-deleted with their file, so this reports what is still
     * stored per interval rather than an immutable upload ledger.
     */
    readonly listUploadsSince: (
      since: Date
    ) => Effect.Effect<readonly AdminBucketUploadRow[], AdminBucketFilesDatabaseError>
  }
>()('AdminBucketFilesRepository') {}
