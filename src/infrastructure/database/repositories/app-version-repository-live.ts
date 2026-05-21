/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AppVersionDatabaseError,
  AppVersionRepository,
} from '@/application/ports/repositories/app-version-repository'
import { db } from '@/infrastructure/database'
import { sovriumAppVersions } from '@/infrastructure/database/drizzle/schema/app-versioning'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import type { AppVersion, AppVersionListItem, AppVersionSource } from '@/domain/models/system'

const wrap = makeDbWrap((cause) => new AppVersionDatabaseError({ cause }))

const decodeSource = (raw: unknown): AppVersionSource =>
  raw === 'config-file' || raw === 'env' || raw === 'api' || raw === 'mcp' || raw === 'restore'
    ? raw
    : 'config-file'

const decodeRow = (row: Record<string, unknown>): AppVersion => {
  const restored = row['restoredFromVersion']
  const restoredFromVersion =
    typeof restored === 'number' ? restored : restored === undefined ? undefined : Number(restored)

  const { fileChecksum } = row
  return {
    versionNumber: Number(row['versionNumber']),
    snapshot: row['snapshot'],
    checksum: String(row['checksum']),
    createdAt: row['createdAt'] as Date,
    createdByUserId: String(row['createdByUserId']),
    source: decodeSource(row['source']),
    message: typeof row['message'] === 'string' ? (row['message'] as string) : '',
    ...(typeof fileChecksum === 'string' && fileChecksum.length > 0 ? { fileChecksum } : {}),
    ...(restoredFromVersion !== undefined ? { restoredFromVersion } : {}),
  }
}

const decodeListRow = (row: Record<string, unknown>): AppVersionListItem => {
  const restored = row['restoredFromVersion']
  const restoredFromVersion =
    typeof restored === 'number' ? restored : restored === undefined ? undefined : Number(restored)

  const { fileChecksum } = row
  return {
    versionNumber: Number(row['versionNumber']),
    checksum: String(row['checksum']),
    createdAt: row['createdAt'] as Date,
    createdByUserId: String(row['createdByUserId']),
    source: decodeSource(row['source']),
    message: typeof row['message'] === 'string' ? (row['message'] as string) : '',
    ...(typeof fileChecksum === 'string' && fileChecksum.length > 0 ? { fileChecksum } : {}),
    ...(restoredFromVersion !== undefined ? { restoredFromVersion } : {}),
  }
}

export const AppVersionRepositoryLive = Layer.succeed(AppVersionRepository, {
  list: () =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(sovriumAppVersions)
        .orderBy(desc(sovriumAppVersions.versionNumber))
      return rows.map((row) => decodeListRow(row as Record<string, unknown>))
    }),

  get: (versionNumber: number) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(sovriumAppVersions)
        .where(eq(sovriumAppVersions.versionNumber, versionNumber))
        .limit(1)
      return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
    }),

  create: ({
    snapshot,
    checksum,
    createdByUserId,
    source,
    fileChecksum,
    message,
    restoredFromVersion,
  }) =>
    wrap(async () => {
      const [row] = await db
        .insert(sovriumAppVersions)
        .values({
          snapshot: snapshot as never,
          checksum,
          createdByUserId,
          source,
          message,
          ...(fileChecksum !== undefined ? { fileChecksum } : {}),
          ...(restoredFromVersion !== undefined ? { restoredFromVersion } : {}),
        } as never)
        .returning()
      return decodeRow((row ?? {}) as Record<string, unknown>)
    }),

  latest: () =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(sovriumAppVersions)
        .orderBy(desc(sovriumAppVersions.versionNumber))
        .limit(1)
      return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
    }),
})
