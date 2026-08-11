/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, desc, eq, gt, like, lt, or, sql, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AdminBucketFilesDatabaseError,
  AdminBucketFilesRepository,
  type AdminBucketFileRow,
  type AdminBucketFilesListFilters,
} from '@/application/ports/repositories/buckets/admin-bucket-files-repository'
import { toFiniteCount } from '@/domain/utils/database/count-coercion'
import { db } from '@/infrastructure/database'
import { fileStorageMetadataTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/** Wrap a DB promise, adapting failures to AdminBucketFilesDatabaseError. */
const wrap = makeDbWrap((cause) => new AdminBucketFilesDatabaseError({ cause }))

/**
 * Build the optional mimeType filter condition list. A `typePrefix` resolves to
 * a `LIKE '<prefix>%'` match (used for both `image/` prefix and an exact
 * `image/png` — the use case routes exact matches through `typeExact`); a
 * `typeExact` resolves to a strict `=` match. Spread immutably so the result is
 * a frozen ReadonlyArray<SQL>.
 */
const buildTypeConditions = (filters: AdminBucketFilesListFilters): ReadonlyArray<SQL> => {
  const files = fileStorageMetadataTable()
  if (filters.typeExact !== undefined) {
    return [eq(files.mimeType, filters.typeExact)]
  }
  if (filters.typePrefix !== undefined) {
    // Escape LIKE wildcards in the operator-supplied prefix so a literal `%` or
    // `_` in a mimeType prefix is matched literally (S3 — value is bound, the
    // pattern is sanitized).
    const escaped = filters.typePrefix
      .replaceAll('\\', '\\\\')
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_')
    return [like(files.mimeType, `${escaped}%`)]
  }
  return []
}

/**
 * Build the deterministic cursor-seek predicate for the `(<sortKey>, id)` tuple.
 * For `desc`: rows strictly "after" the cursor are `sortCol < value OR (sortCol
 * = value AND id < id)`. For `asc`: the mirror with `>`. Returns an empty list
 * when no cursor is set (first page).
 *
 * The `date` sort compares against the `createdAt` timestamp column — the cursor
 * value is an ISO string, coerced to a `Date` so the bound parameter matches the
 * column's native type on both dialects. The `size` sort compares against the
 * integer byte column — the cursor value is the numeric size as a string,
 * coerced to `Number`.
 */
const buildCursorConditions = (filters: AdminBucketFilesListFilters): ReadonlyArray<SQL> => {
  if (filters.cursor === undefined) return []
  const files = fileStorageMetadataTable()
  const { value, id } = filters.cursor

  const sortCol = filters.sort === 'size' ? files.size : files.createdAt
  const sortValue: Readonly<Date> | number =
    filters.sort === 'size' ? Number(value) : new Date(value)

  const beyond = filters.order === 'asc' ? gt(sortCol, sortValue) : lt(sortCol, sortValue)
  const tieBreak = filters.order === 'asc' ? gt(files.id, id) : lt(files.id, id)
  const seek = or(beyond, and(eq(sortCol, sortValue), tieBreak))
  return seek !== undefined ? [seek] : []
}

/**
 * Drizzle implementation for {@link AdminBucketFilesRepository.listFiles}.
 * Pulled out of the `wrap()` callback so the latter stays under the complexity
 * cap. Fetches `limit + 1` rows ordered by the `(<sortKey>, id)` tuple so the
 * use case can derive `hasMore`.
 */
const listFilesImpl = async (
  filters: AdminBucketFilesListFilters
): Promise<ReadonlyArray<AdminBucketFileRow>> => {
  const files = fileStorageMetadataTable()
  const conditions = [...buildTypeConditions(filters), ...buildCursorConditions(filters)]

  const sortCol = filters.sort === 'size' ? files.size : files.createdAt
  const direction = filters.order === 'asc' ? asc : desc
  // `id` is the deterministic tie-breaker — same direction as the primary key so
  // the `(<sortKey>, id)` tuple is strictly monotonic and the cursor never
  // revisits a row.
  const orderBy: ReadonlyArray<SQL> = [direction(sortCol), direction(files.id)]

  const query = db
    .select({
      id: files.id,
      key: files.key,
      filename: files.filename,
      mimeType: files.mimeType,
      size: files.size,
      createdAt: files.createdAt,
    })
    .from(files)
    .orderBy(...orderBy)
    .limit(filters.limit + 1)

  const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query
  return rows as ReadonlyArray<AdminBucketFileRow>
}

/**
 * Admin Bucket Files Repository Implementation (Drizzle).
 *
 * Two dialect-aware reads over `system.file_storage_metadata` backing the admin
 * bucket file browser. All projection / cursor / pagination logic lives in the
 * `bucket-files` use case; this layer emits only raw queries. Dialect
 * resolution is handled by the per-call `fileStorageMetadataTable()` selector
 * (PG `system.file_storage_metadata` vs SQLite flat
 * `system_file_storage_metadata`).
 *
 * Sovrium today backs every named bucket with a single virtual "default"
 * bucket, so the listing reads ALL metadata rows — the per-named-bucket
 * projection is a Phase-1 concern. This replicates the legacy basic handler's
 * "all keys" semantics (the spec asserts non-empty / shape / ordering, not
 * per-bucket scoping).
 */
export const AdminBucketFilesRepositoryLive = Layer.succeed(AdminBucketFilesRepository, {
  listFiles: (filters) => wrap(async () => listFilesImpl(filters)),

  sumTotalBytes: () =>
    wrap(async () => {
      const files = fileStorageMetadataTable()
      const rows = (await db
        .select({ total: sql<number | string | null>`COALESCE(SUM(${files.size}), 0)` })
        .from(files)) as ReadonlyArray<{ total: number | string | null }>
      return toFiniteCount(rows[0]?.total)
    }),
})
