/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AppDraftDatabaseError,
  AppDraftRepository,
} from '@/application/ports/repositories/app-draft-repository'
import { db } from '@/infrastructure/database'
import { sovriumAppDrafts } from '@/infrastructure/database/drizzle/schema/app-versioning'
import type { AppDraft } from '@/domain/models/system'

/**
 * App Draft Repository Implementation (Drizzle).
 *
 * Phase 1 enforces a singleton row keyed by id='singleton'. The
 * `upsert` is implemented via Postgres `INSERT ... ON CONFLICT DO
 * UPDATE`, so concurrent admins observe a consistent post-state
 * regardless of whether the row already existed.
 */
const SINGLETON_ID = 'singleton'

const decodeRow = (row: Record<string, unknown>): AppDraft => ({
  snapshot: row['snapshot'],
  baseVersion: Number(row['baseVersion'] ?? 0),
  updatedAt: row['updatedAt'] as Date,
  updatedByUserId: String(row['updatedByUserId']),
})

/** @public */
export const AppDraftRepositoryLive = Layer.succeed(AppDraftRepository, {
  get: () =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(sovriumAppDrafts)
          .where(eq(sovriumAppDrafts.id, SINGLETON_ID))
          .limit(1)
        return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
      },
      catch: (cause) => new AppDraftDatabaseError({ cause }),
    }),

  upsert: ({ snapshot, baseVersion, updatedByUserId }) =>
    Effect.tryPromise({
      try: async () => {
        const now = new Date()
        const [row] = await db
          .insert(sovriumAppDrafts)
          .values({
            id: SINGLETON_ID,
            snapshot: snapshot as never,
            baseVersion,
            updatedAt: now,
            updatedByUserId,
          })
          .onConflictDoUpdate({
            target: sovriumAppDrafts.id,
            set: {
              snapshot: snapshot as never,
              baseVersion,
              updatedAt: now,
              updatedByUserId,
            },
          })
          .returning()
        return decodeRow((row ?? {}) as Record<string, unknown>)
      },
      catch: (cause) => new AppDraftDatabaseError({ cause }),
    }),

  discard: () =>
    Effect.tryPromise({
      try: () => db.delete(sovriumAppDrafts).where(eq(sovriumAppDrafts.id, SINGLETON_ID)),
      catch: (cause) => new AppDraftDatabaseError({ cause }),
    }).pipe(Effect.asVoid),
})
