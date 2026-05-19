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
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import type { PreviewSession, PreviewSessionStatus } from '@/domain/models/system'

const wrap = makeDbWrap((cause) => new PreviewSessionDatabaseError({ cause }))

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

export const PreviewSessionRepositoryLive = Layer.succeed(PreviewSessionRepository, {
  create: ({ previewId, port, draftSnapshot, expiresAt, createdByUserId }) =>
    wrap(async () => {
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
    }),

  get: (previewId: string) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(sovriumPreviewSessions)
        .where(eq(sovriumPreviewSessions.previewId, previewId))
        .limit(1)
      return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
    }),

  list: () =>
    wrap(async () => {
      const rows = await db.select().from(sovriumPreviewSessions)
      return rows.map((row) => decodeRow(row as Record<string, unknown>))
    }),

  markStopped: (previewId: string) =>
    wrap(() =>
      db
        .update(sovriumPreviewSessions)
        .set({ status: 'stopped' })
        .where(eq(sovriumPreviewSessions.previewId, previewId))
    ).pipe(Effect.asVoid),

  pruneExpired: () =>
    wrap(async () => {
      const now = new Date()
      const updated = await db
        .update(sovriumPreviewSessions)
        .set({ status: 'expired' })
        .where(
          and(
            lt(sovriumPreviewSessions.expiresAt, now),
            ne(sovriumPreviewSessions.status, 'expired'),
            ne(sovriumPreviewSessions.status, 'stopped')
          )
        )
        .returning({ previewId: sovriumPreviewSessions.previewId })
      return updated.length
    }),

  updateStatus: ({ previewId, status }) =>
    wrap(() =>
      db
        .update(sovriumPreviewSessions)
        .set({ status })
        .where(eq(sovriumPreviewSessions.previewId, previewId))
    ).pipe(Effect.asVoid),
})
