/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  ShareLinkDatabaseError,
  ShareLinkRepository,
  type ShareLinkRow,
} from '@/application/ports/repositories/share-link-repository'
import { db } from '@/infrastructure/database'
import { shareLinks } from '@/infrastructure/database/drizzle/schema/share-links'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((cause) => new ShareLinkDatabaseError({ cause }))

const decodeRow = (row: Record<string, unknown>): ShareLinkRow => {
  const expiresAt = row['expiresAt'] as Date | null | undefined
  const revokedAt = row['revokedAt'] as Date | null | undefined
  const lastAccessedAt = row['lastAccessedAt'] as Date | null | undefined
  const passwordHash = row['passwordHash'] as string | null | undefined
  const createdById = row['createdById'] as string | null | undefined
  return {
    id: String(row['id']),
    pageName: String(row['pageName']),
    token: String(row['token']),
    passwordHash:
      typeof passwordHash === 'string' && passwordHash !== '' ? passwordHash : undefined,
    expiresAt: expiresAt instanceof Date ? expiresAt : undefined,
    embedAllowed: Boolean(row['embedAllowed']),
    createdById: typeof createdById === 'string' ? createdById : undefined,
    createdAt: row['createdAt'] as Date,
    revokedAt: revokedAt instanceof Date ? revokedAt : undefined,
    viewCount: Number(row['viewCount'] ?? 0),
    lastAccessedAt: lastAccessedAt instanceof Date ? lastAccessedAt : undefined,
  }
}

export const ShareLinkRepositoryLive = Layer.succeed(ShareLinkRepository, {
  create: ({ pageName, token, passwordHash, expiresAt, embedAllowed, createdById }) =>
    wrap(async () => {
      const [row] = await db
        .insert(shareLinks)
        .values({
          pageName,
          token,
          ...(passwordHash !== undefined ? { passwordHash } : {}),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
          ...(embedAllowed !== undefined ? { embedAllowed } : {}),
          ...(createdById !== undefined ? { createdById } : {}),
        })
        .returning()
      return decodeRow((row ?? {}) as Record<string, unknown>)
    }),

  findByToken: (token) =>
    wrap(async () => {
      const rows = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1)
      return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
    }),

  findActiveByToken: (token) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(shareLinks)
        .where(
          and(
            eq(shareLinks.token, token),
            isNull(shareLinks.revokedAt),
            or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, new Date()))
          )
        )
        .limit(1)
      return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
    }),

  listForPage: (pageName) =>
    wrap(async () => {
      const rows = await db.select().from(shareLinks).where(eq(shareLinks.pageName, pageName))
      return rows.map((row) => decodeRow(row as Record<string, unknown>))
    }),

  update: ({ token, passwordHash, expiresAt, embedAllowed }) =>
    wrap(async () => {
      const set: Record<string, unknown> = {
        ...(passwordHash !== undefined ? { passwordHash } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        ...(embedAllowed !== undefined ? { embedAllowed } : {}),
      }
      if (Object.keys(set).length === 0) {
        const rows = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1)
        return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
      }
      const [row] = await db
        .update(shareLinks)
        .set(set)
        .where(eq(shareLinks.token, token))
        .returning()
      return row !== undefined ? decodeRow(row as Record<string, unknown>) : undefined
    }),

  revoke: (token) =>
    wrap(async () => {
      const updated = await db
        .update(shareLinks)
        .set({ revokedAt: new Date() })
        .where(and(eq(shareLinks.token, token), isNull(shareLinks.revokedAt)))
        .returning({ id: shareLinks.id })
      return updated.length > 0
    }),

  recordAccess: (token) =>
    wrap(async () => {
      const [row] = await db
        .update(shareLinks)
        .set({
          viewCount: sql`${shareLinks.viewCount} + 1`,
          lastAccessedAt: new Date(),
        })
        .where(eq(shareLinks.token, token))
        .returning({ viewCount: shareLinks.viewCount })
      return Number(row?.viewCount ?? 0)
    }),
})
