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
 *     `(<sortKey>, id)` tuple (`(createdAt, id)` for `date`, `(size, id)` for
 *     `size`) so two files with the same timestamp/size never collapse into one
 *     cursor position.
 *   - {@link sumTotalBytes} — `SUM(size)` across the entire bucket, invariant
 *     across both the `type` filter and pagination (the file-browser quota bar
 *     renders the bucket total, not the current page's sum).
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
 * Resolved WHERE / ORDER inputs for the file-list reader. The use case parses +
 * validates the raw query string (and decodes the opaque cursor) into this
 * shape; the repository turns it into dialect-aware drizzle predicates.
 *
 * - `sort` — the column the page orders + the cursor seeks on (`date` →
 *   `createdAt`, `size` → byte size).
 * - `order` — `asc` | `desc`.
 * - `typePrefix` — when set, a `LIKE '<prefix>%'` mimeType filter (the use case
 *   resolves a trailing-slash value into a prefix; an exact value becomes a
 *   single-element prefix that LIKE-matches itself).
 * - `typeExact` — when set, an exact `=` mimeType filter (mutually exclusive
 *   with `typePrefix`).
 * - `cursor` — the decoded `(value, id)` tuple from the opaque cursor; the
 *   repository emits the dialect-aware seek predicate for it.
 * - `limit` — the page size; the repository fetches `limit + 1` rows so the use
 *   case can compute `hasMore` / `nextCursor`.
 */
export interface AdminBucketFilesListFilters {
  readonly sort: 'size' | 'date'
  readonly order: 'asc' | 'desc'
  readonly typePrefix?: string | undefined
  readonly typeExact?: string | undefined
  readonly cursor?: { readonly value: string; readonly id: string } | undefined
  readonly limit: number
}

export class AdminBucketFilesRepository extends Context.Tag('AdminBucketFilesRepository')<
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
    readonly sumTotalBytes: () => Effect.Effect<number, AdminBucketFilesDatabaseError>
  }
>() {}
