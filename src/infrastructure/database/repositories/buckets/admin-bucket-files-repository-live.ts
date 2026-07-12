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
import { db } from '@/infrastructure/database'
import { fileStorageMetadataTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((cause) => new AdminBucketFilesDatabaseError({ cause }))

const buildTypeConditions = (filters: AdminBucketFilesListFilters): ReadonlyArray<SQL> => {
  const files = fileStorageMetadataTable()
  if (filters.typeExact !== undefined) {
    return [eq(files.mimeType, filters.typeExact)]
  }
  if (filters.typePrefix !== undefined) {
    const escaped = filters.typePrefix
      .replaceAll('\\', '\\\\')
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_')
    return [like(files.mimeType, `${escaped}%`)]
  }
  return []
}

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

const listFilesImpl = async (
  filters: AdminBucketFilesListFilters
): Promise<ReadonlyArray<AdminBucketFileRow>> => {
  const files = fileStorageMetadataTable()
  const conditions = [...buildTypeConditions(filters), ...buildCursorConditions(filters)]

  const sortCol = filters.sort === 'size' ? files.size : files.createdAt
  const direction = filters.order === 'asc' ? asc : desc
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

export const AdminBucketFilesRepositoryLive = Layer.succeed(AdminBucketFilesRepository, {
  listFiles: (filters) => wrap(async () => listFilesImpl(filters)),

  sumTotalBytes: () =>
    wrap(async () => {
      const files = fileStorageMetadataTable()
      const rows = (await db
        .select({ total: sql<number | string | null>`COALESCE(SUM(${files.size}), 0)` })
        .from(files)) as ReadonlyArray<{ total: number | string | null }>
      return Number(rows[0]?.total ?? 0)
    }),
})
