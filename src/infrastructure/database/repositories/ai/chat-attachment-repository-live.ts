/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { Layer, Option } from 'effect'
import {
  ChatAttachmentDatabaseError,
  ChatAttachmentRepository,
  type ChatAttachmentRecord,
} from '@/application/ports/repositories/ai/chat-attachment-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { aiChatAttachments as attachmentsPg } from '@/infrastructure/database/drizzle/schema/ai'
import { aiChatAttachments as attachmentsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/ai'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const attachments = resolveDialectSchema(attachmentsPg, attachmentsSqlite)

const wrap = makeDbWrap((cause) => new ChatAttachmentDatabaseError({ cause }))

/** The row as Drizzle returns it, on either dialect. */
type AttachmentRow = typeof attachments.$inferSelect

const toRecord = (row: Readonly<AttachmentRow>): ChatAttachmentRecord => ({
  id: row.id,
  userId: row.userId,
  chatId: row.chatId,
  sessionId: row.sessionId ?? undefined,
  bucket: row.bucket,
  storageKey: row.storageKey,
  name: row.name,
  size: row.size,
  mimeType: row.mimeType,
  createdAt: new Date(row.createdAt),
})

const ownedAmong = (ids: readonly string[], userId: string) =>
  and(inArray(attachments.id, [...ids]), eq(attachments.userId, userId))

/**
 * Chat attachments repository (Drizzle), on `system.ai_chat_attachments`.
 * Every statement carries the caller's `user_id`.
 */
export const ChatAttachmentRepositoryLive = Layer.succeed(ChatAttachmentRepository, {
  insert: (row) =>
    wrap(async (): Promise<void> => {
      await db.insert(attachments).values({ ...row, createdAt: new Date() })
    }),

  findOwned: ({ id, userId }) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(attachments)
        .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
        .limit(1)
      const [row] = rows
      return row === undefined ? Option.none() : Option.some(toRecord(row))
    }),

  findManyOwned: ({ ids, userId }) =>
    wrap(async (): Promise<readonly ChatAttachmentRecord[]> => {
      if (ids.length === 0) return []
      const rows = await db.select().from(attachments).where(ownedAmong(ids, userId))
      return rows.map(toRecord)
    }),

  bindToSession: ({ ids, userId, sessionId }) =>
    wrap(async (): Promise<void> => {
      if (ids.length === 0) return
      await db
        .update(attachments)
        .set({ sessionId })
        .where(and(ownedAmong(ids, userId), isNull(attachments.sessionId)))
    }),

  listForSession: ({ userId, sessionId }) =>
    wrap(async (): Promise<readonly ChatAttachmentRecord[]> => {
      const rows = await db
        .select()
        .from(attachments)
        .where(and(eq(attachments.userId, userId), eq(attachments.sessionId, sessionId)))
      return rows.map(toRecord)
    }),

  deleteOwned: ({ ids, userId }) =>
    wrap(async (): Promise<void> => {
      if (ids.length === 0) return
      await db.delete(attachments).where(ownedAmong(ids, userId))
    }),
})
