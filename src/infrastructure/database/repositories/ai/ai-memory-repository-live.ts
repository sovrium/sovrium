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
} from '@/application/ports/repositories/ai/ai-memory-repository'
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
} from '@/application/ports/repositories/ai/ai-memory-repository'

const aiConversations = resolveDialectSchema(aiConversationsPg, aiConversationsSqlite)
const aiMessages = resolveDialectSchema(aiMessagesPg, aiMessagesSqlite)

/** Wrap a DB promise, adapting failures to AiMemoryDatabaseError. */
const wrap = makeDbWrap((cause) => new AiMemoryDatabaseError({ cause }))

/**
 * Derive a conversation title from the first user message.
 *
 * Keeps it short (a thread label, not the whole message) — truncates to 60
 * characters with an ellipsis. [internal ref] only asserts the title is a
 * non-empty string, so any deterministic projection of the first message is
 * acceptable.
 */
const deriveTitle = (firstMessage: string): string => {
  const trimmed = firstMessage.trim()
  if (trimmed.length === 0) return 'New conversation'
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed
}

/**
 * Resolve the conversation row id for a `(userId, sessionId)` thread,
 * creating the row on first use. `firstMessage` seeds the auto-generated
 * title; `agentName` distinguishes per-agent threads.
 *
 * On every call the conversation's `updatedAt` is bumped so the retention
 * sweep and the most-recently-updated ordering both observe live activity.
 */
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
  // `returning()` always yields the inserted row; the fallback keeps the
  // function total against unexpected driver behaviour.
  return created?.id ?? ''
}

/**
 * AI Memory Repository Implementation (Drizzle).
 *
 * Persists chat turns to `system.ai_conversations` / `system.ai_messages`.
 * `ai_messages.conversation_id` has `ON DELETE CASCADE`, so deleting a
 * conversation removes all its messages without an explicit message delete.
 */
export const AiMemoryRepositoryLive = Layer.succeed(AiMemoryRepository, {
  recordTurn: ({ userId, sessionId, userMessage, assistantReply, agentName, model }) =>
    wrap(async (): Promise<void> => {
      const conversationId = await ensureConversation({
        userId,
        sessionId,
        firstMessage: userMessage,
        agentName,
      })
      // `created_at` is stamped EXPLICITLY, one millisecond apart, rather than
      // left to the column default.
      //
      // A turn is two rows written in one statement, and every reader orders
      // them by `created_at`. The default gives both rows the SAME instant — on
      // Postgres because `now()` is the transaction timestamp, on SQLite because
      // two `new Date()` calls in one batch land in the same millisecond. The
      // readers then fell through to their tie-break, `id ASC`, which is a
      // random UUID on both dialects: a coin flip deciding whether a transcript
      // reads user-then-assistant or assistant-then-user. That surfaced as a
      // ~50% flaky spec, but the transcript endpoint is the small half of it —
      // `getHistory` feeds prior turns back to the MODEL, so half the time the
      // model was handed its own reply as though it preceded the question.
      //
      // Ordering belongs in the data, not in a tie-break: the assistant reply
      // genuinely happens after the user message, so the timestamps say so and
      // every reader — present and future, on both dialects — gets it right
      // without needing to know about this.
      const askedAt = new Date()
      const answeredAt = new Date(askedAt.getTime() + 1)
      return db
        .insert(aiMessages)
        .values([
          {
            conversationId,
            role: 'user',
            content: userMessage,
            status: 'complete',
            createdAt: askedAt,
          },
          {
            conversationId,
            role: 'assistant',
            content: assistantReply,
            status: 'complete',
            createdAt: answeredAt,
            ...(model !== undefined ? { model } : {}),
          },
        ])
        .then(() => undefined)
    }),

  getHistory: ({ userId, sessionId }) =>
    wrap(async (): Promise<ReadonlyArray<AiMemoryMessage>> => {
      // Chronological, and it has to be exactly right: this is the transcript
      // replayed INTO the model as prior context, so a mis-ordered pair tells
      // the model it answered before it was asked. `recordTurn` guarantees the
      // ordering in the data (distinct `created_at` per turn); `id ASC` trails
      // only as a stability tie-break, never as a chronological fallback — the
      // id is a random UUID and would sort a genuine tie by coin flip.
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
        .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id))
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
