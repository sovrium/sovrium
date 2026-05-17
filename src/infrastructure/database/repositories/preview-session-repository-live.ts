/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, lt, ne } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  PreviewSessionDatabaseError,
  PreviewSessionRepository,
} from '@/application/ports/repositories/preview-session-repository'
import { db } from '@/infrastructure/database'
import { sovriumPreviewSessions } from '@/infrastructure/database/drizzle/schema/app-versioning'
import type { PreviewSession, PreviewSessionStatus } from '@/domain/models/system'

/**
 * Preview Session Repository Implementation (Drizzle).
 *
 * Phase 1 only persists the row lifecycle — Phase 3 will spawn the
 * actual child server and wire its lifecycle callbacks (`ready`,
 * `crashed`, `stop`) to `updateStatus` / `markStopped`.
 *
 * The DB column `status` is a free-form text column (no Postgres ENUM)
 * so future statuses can be added without a migration; the application
 * layer is the source of truth for valid transitions.
 */
const VALID_STATUSES: ReadonlyArray<PreviewSessionStatus> = [
  'starting',
  'running',
  'stopped',
  'expired',
]

const decodeStatus = (value: unknown): PreviewSessionStatus => {
  const str = String(value)
  return (VALID_STATUSES as ReadonlyArray<string>).includes(str)
    ? (str as PreviewSessionStatus)
    : 'starting'
}

const decodeRow = (row: Record<string, unknown>): PreviewSession => ({
  previewId: String(row['previewId']),
  port: Number(row['port']),
  draftSnapshot: row['draftSnapshot'],
  expiresAt: row['expiresAt'] as Date,
  status: decodeStatus(row['status']),
  createdByUserId: String(row['createdByUserId']),
  createdAt: row['createdAt'] as Date,
})

/** @public */
export const PreviewSessionRepositoryLive = Layer.succeed(PreviewSessionRepository, {
  create: ({ previewId, port, draftSnapshot, expiresAt, createdByUserId }) =>
    Effect.tryPromise({
      try: async () => {
        const [row] = await db
          .insert(sovriumPreviewSessions)
          .values({
            previewId,
            port,
            draftSnapshot: draftSnapshot as never,
            expiresAt,
            status: 'starting',
            createdByUserId,
          })
          .returning()
        return decodeRow((row ?? {}) as Record<string, unknown>)
      },
      catch: (cause) => new PreviewSessionDatabaseError({ cause }),
    }),

  get: (previewId: string) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(sovriumPreviewSessions)
          .where(eq(sovriumPreviewSessions.previewId, previewId))
          .limit(1)
        return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
      },
      catch: (cause) => new PreviewSessionDatabaseError({ cause }),
    }),

  list: () =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db.select().from(sovriumPreviewSessions)
        return rows.map((row) => decodeRow(row as Record<string, unknown>))
      },
      catch: (cause) => new PreviewSessionDatabaseError({ cause }),
    }),

  markStopped: (previewId: string) =>
    Effect.tryPromise({
      try: () =>
        db
          .update(sovriumPreviewSessions)
          .set({ status: 'stopped' })
          .where(eq(sovriumPreviewSessions.previewId, previewId)),
      catch: (cause) => new PreviewSessionDatabaseError({ cause }),
    }).pipe(Effect.asVoid),

  pruneExpired: () =>
    Effect.tryPromise({
      try: async () => {
        const now = new Date()
        const updated = await db
          .update(sovriumPreviewSessions)
          .set({ status: 'expired' })
          .where(
            and(
              lt(sovriumPreviewSessions.expiresAt, now),
              // Don't re-mark already-expired or stopped rows so the
              // returned count accurately reflects the transition.
              ne(sovriumPreviewSessions.status, 'expired'),
              ne(sovriumPreviewSessions.status, 'stopped')
            )
          )
          .returning({ previewId: sovriumPreviewSessions.previewId })
        return updated.length
      },
      catch: (cause) => new PreviewSessionDatabaseError({ cause }),
    }),

  updateStatus: ({ previewId, status }) =>
    Effect.tryPromise({
      try: () =>
        db
          .update(sovriumPreviewSessions)
          .set({ status })
          .where(eq(sovriumPreviewSessions.previewId, previewId)),
      catch: (cause) => new PreviewSessionDatabaseError({ cause }),
    }).pipe(Effect.asVoid),
})
