/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  ShareLinkDatabaseError,
  ShareLinkRepository,
  type ShareLinkRow,
} from '@/application/ports/repositories/share-link-repository'
import { db } from '@/infrastructure/database'
import { shareLinks } from '@/infrastructure/database/drizzle/schema/share-links'

/**
 * Share Link Repository Implementation (Drizzle).
 *
 * `findActiveByToken` filters out revoked AND expired rows in a single
 * query so public-route callers can't accidentally serve a revoked
 * link. `findByToken` returns everything (admin tooling).
 *
 * `recordAccess` is `view_count = view_count + 1` in a single UPDATE,
 * which is naturally atomic at the row level — no SELECT needed.
 *
 * `update` accepts `null` for nullable columns so callers can
 * explicitly clear an expiry or remove a password (Drizzle's update
 * treats `undefined` as "skip", null as "set NULL").
 */
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
    Effect.tryPromise({
      try: async () => {
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
      },
      catch: (cause) => new ShareLinkDatabaseError({ cause }),
    }),

  findByToken: (token) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1)
        return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
      },
      catch: (cause) => new ShareLinkDatabaseError({ cause }),
    }),

  findActiveByToken: (token) =>
    Effect.tryPromise({
      try: async () => {
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
      },
      catch: (cause) => new ShareLinkDatabaseError({ cause }),
    }),

  listForPage: (pageName) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db.select().from(shareLinks).where(eq(shareLinks.pageName, pageName))
        return rows.map((row) => decodeRow(row as Record<string, unknown>))
      },
      catch: (cause) => new ShareLinkDatabaseError({ cause }),
    }),

  update: ({ token, passwordHash, expiresAt, embedAllowed }) =>
    Effect.tryPromise({
      try: async () => {
        // Drizzle accepts a literal `null` to set the column to NULL,
        // and treats `undefined` as "skip the column". Specs use this
        // distinction (passwordHash: null → clear password protection).
        const set: Record<string, unknown> = {
          ...(passwordHash !== undefined ? { passwordHash } : {}),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
          ...(embedAllowed !== undefined ? { embedAllowed } : {}),
        }
        if (Object.keys(set).length === 0) {
          // Nothing to update — return the row as-is so callers can
          // chain consistently.
          const rows = await db
            .select()
            .from(shareLinks)
            .where(eq(shareLinks.token, token))
            .limit(1)
          return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
        }
        const [row] = await db
          .update(shareLinks)
          .set(set)
          .where(eq(shareLinks.token, token))
          .returning()
        return row !== undefined ? decodeRow(row as Record<string, unknown>) : undefined
      },
      catch: (cause) => new ShareLinkDatabaseError({ cause }),
    }),

  revoke: (token) =>
    Effect.tryPromise({
      try: async () => {
        const updated = await db
          .update(shareLinks)
          .set({ revokedAt: new Date() })
          .where(and(eq(shareLinks.token, token), isNull(shareLinks.revokedAt)))
          .returning({ id: shareLinks.id })
        return updated.length > 0
      },
      catch: (cause) => new ShareLinkDatabaseError({ cause }),
    }),

  recordAccess: (token) =>
    Effect.tryPromise({
      try: async () => {
        const [row] = await db
          .update(shareLinks)
          .set({
            viewCount: sql`${shareLinks.viewCount} + 1`,
            lastAccessedAt: new Date(),
          })
          .where(eq(shareLinks.token, token))
          .returning({ viewCount: shareLinks.viewCount })
        return Number(row?.viewCount ?? 0)
      },
      catch: (cause) => new ShareLinkDatabaseError({ cause }),
    }),
})
