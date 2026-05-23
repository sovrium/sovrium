/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, desc, eq, lt } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AiMemoryDatabaseError,
  AiMemoryRepository,
} from '@/application/ports/repositories/ai-memory-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  aiConversations as aiConversationsPg,
  aiMessages as aiMessagesPg,
} from '@/infrastructure/database/drizzle/schema/ai'
import {
  aiConversations as aiConversationsSqlite,
  aiMessages as aiMessagesSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/ai'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import type {
  AiMemoryConversationSummary,
  AiMemoryMessage,
} from '@/application/ports/repositories/ai-memory-repository'

const aiConversations = resolveDialectSchema(aiConversationsPg, aiConversationsSqlite)
const aiMessages = resolveDialectSchema(aiMessagesPg, aiMessagesSqlite)

const wrap = makeDbWrap((cause) => new AiMemoryDatabaseError({ cause }))

const deriveTitle = (firstMessage: string): string => {
  const trimmed = firstMessage.trim()
  if (trimmed.length === 0) return 'New conversation'
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed
}

const ensureConversation = async (input: {
  readonly userId: string
  readonly sessionId: string
  readonly firstMessage: string
  readonly agentName: string | undefined
}): Promise<string> => {
  const existing = await db
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(
      and(eq(aiConversations.userId, input.userId), eq(aiConversations.sessionId, input.sessionId))
    )
    .limit(1)
  const found = existing[0]
  if (found !== undefined) {
    return db
      .update(aiConversations)
      .set({ updatedAt: new Date() })
      .where(eq(aiConversations.id, found.id))
      .then(() => found.id)
  }
  const [created] = await db
    .insert(aiConversations)
    .values({
      userId: input.userId,
      sessionId: input.sessionId,
      title: deriveTitle(input.firstMessage),
      ...(input.agentName !== undefined ? { agentName: input.agentName } : {}),
    })
    .returning({ id: aiConversations.id })
  return created?.id ?? ''
}

export const AiMemoryRepositoryLive = Layer.succeed(AiMemoryRepository, {
  recordTurn: ({ userId, sessionId, userMessage, assistantReply, agentName, model }) =>
    wrap(async (): Promise<void> => {
      const conversationId = await ensureConversation({
        userId,
        sessionId,
        firstMessage: userMessage,
        agentName,
      })
      return db
        .insert(aiMessages)
        .values([
          { conversationId, role: 'user', content: userMessage, status: 'complete' },
          {
            conversationId,
            role: 'assistant',
            content: assistantReply,
            status: 'complete',
            ...(model !== undefined ? { model } : {}),
          },
        ])
        .then(() => undefined)
    }),

  getHistory: ({ userId, sessionId }) =>
    wrap(async (): Promise<ReadonlyArray<AiMemoryMessage>> => {
      const rows = await db
        .select({
          role: aiMessages.role,
          content: aiMessages.content,
          status: aiMessages.status,
          createdAt: aiMessages.createdAt,
        })
        .from(aiMessages)
        .innerJoin(aiConversations, eq(aiMessages.conversationId, aiConversations.id))
        .where(and(eq(aiConversations.userId, userId), eq(aiConversations.sessionId, sessionId)))
        .orderBy(asc(aiMessages.createdAt))
      return rows
    }),

  listConversations: ({ userId }) =>
    wrap(async (): Promise<ReadonlyArray<AiMemoryConversationSummary>> => {
      const rows = await db
        .select({
          id: aiConversations.id,
          sessionId: aiConversations.sessionId,
          title: aiConversations.title,
          agentName: aiConversations.agentName,
          createdAt: aiConversations.createdAt,
          updatedAt: aiConversations.updatedAt,
        })
        .from(aiConversations)
        .where(eq(aiConversations.userId, userId))
        .orderBy(desc(aiConversations.updatedAt))
      return rows
    }),

  deleteConversation: ({ userId, sessionId }) =>
    wrap(() =>
      db
        .delete(aiConversations)
        .where(and(eq(aiConversations.userId, userId), eq(aiConversations.sessionId, sessionId)))
        .then(() => undefined)
    ),

  purgeExpired: ({ userId, maxAgeDays }) =>
    wrap(async () => {
      const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
      const removed = await db
        .delete(aiConversations)
        .where(and(eq(aiConversations.userId, userId), lt(aiConversations.updatedAt, cutoff)))
        .returning({ id: aiConversations.id })
      return removed.length
    }),
})
