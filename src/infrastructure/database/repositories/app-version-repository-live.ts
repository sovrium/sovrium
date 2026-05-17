/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AppVersionDatabaseError,
  AppVersionRepository,
} from '@/application/ports/repositories/app-version-repository'
import { db } from '@/infrastructure/database'
import { sovriumAppVersions } from '@/infrastructure/database/drizzle/schema/app-versioning'
import type { AppVersion, AppVersionListItem } from '@/domain/models/system'

/**
 * App Version Repository Implementation (Drizzle).
 *
 * Maps `system.sovrium_app_versions` rows to domain `AppVersion` /
 * `AppVersionListItem`. The table is append-only — inserts use
 * `serial` to auto-assign the next versionNumber.
 */
const decodeRow = (row: Record<string, unknown>): AppVersion => {
  const restored = row['restoredFromVersion']
  const restoredFromVersion =
    typeof restored === 'number' ? restored : restored === undefined ? undefined : Number(restored)

  return {
    versionNumber: Number(row['versionNumber']),
    snapshot: row['snapshot'],
    checksum: String(row['checksum']),
    createdAt: row['createdAt'] as Date,
    createdByUserId: String(row['createdByUserId']),
    message: typeof row['message'] === 'string' ? (row['message'] as string) : '',
    ...(restoredFromVersion !== undefined ? { restoredFromVersion } : {}),
  }
}

const decodeListRow = (row: Record<string, unknown>): AppVersionListItem => {
  const restored = row['restoredFromVersion']
  const restoredFromVersion =
    typeof restored === 'number' ? restored : restored === undefined ? undefined : Number(restored)

  return {
    versionNumber: Number(row['versionNumber']),
    checksum: String(row['checksum']),
    createdAt: row['createdAt'] as Date,
    createdByUserId: String(row['createdByUserId']),
    message: typeof row['message'] === 'string' ? (row['message'] as string) : '',
    ...(restoredFromVersion !== undefined ? { restoredFromVersion } : {}),
  }
}

/** @public */
export const AppVersionRepositoryLive = Layer.succeed(AppVersionRepository, {
  list: () =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select({
            versionNumber: sovriumAppVersions.versionNumber,
            checksum: sovriumAppVersions.checksum,
            createdAt: sovriumAppVersions.createdAt,
            createdByUserId: sovriumAppVersions.createdByUserId,
            message: sovriumAppVersions.message,
            restoredFromVersion: sovriumAppVersions.restoredFromVersion,
          })
          .from(sovriumAppVersions)
          .orderBy(desc(sovriumAppVersions.versionNumber))
        return rows.map((row) => decodeListRow(row as Record<string, unknown>))
      },
      catch: (cause) => new AppVersionDatabaseError({ cause }),
    }),

  get: (versionNumber: number) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(sovriumAppVersions)
          .where(eq(sovriumAppVersions.versionNumber, versionNumber))
          .limit(1)
        return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
      },
      catch: (cause) => new AppVersionDatabaseError({ cause }),
    }),

  create: ({ snapshot, checksum, createdByUserId, message, restoredFromVersion }) =>
    Effect.tryPromise({
      try: async () => {
        const [row] = await db
          .insert(sovriumAppVersions)
          .values({
            snapshot: snapshot as never,
            checksum,
            createdByUserId,
            message,
            ...(restoredFromVersion !== undefined ? { restoredFromVersion } : {}),
          })
          .returning()
        return decodeRow((row ?? {}) as Record<string, unknown>)
      },
      catch: (cause) => new AppVersionDatabaseError({ cause }),
    }),

  latest: () =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(sovriumAppVersions)
          .orderBy(desc(sovriumAppVersions.versionNumber))
          .limit(1)
        return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
      },
      catch: (cause) => new AppVersionDatabaseError({ cause }),
    }),
})
