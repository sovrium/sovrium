/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, count, desc, eq, lt } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AiMemoryDatabaseError,
  AiMemoryRepository,
} from '@/application/ports/repositories/ai/ai-memory-repository'
import {
  currentLeaf,
  nextInstant,
  type BranchNode,
} from '@/domain/models/app/agents/conversation-branch-service'
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
  AiMemoryMessage,
  AiMemoryThread,
  AiMessageElicitation,
  AiMessagePart,
} from '@/application/ports/repositories/ai/ai-memory-repository'

const aiConversations = resolveDialectSchema(aiConversationsPg, aiConversationsSqlite)
const aiMessages = resolveDialectSchema(aiMessagesPg, aiMessagesSqlite)

/**
 * A question an agent asked (`ask_user`) rides in the assistant message's
 * `tool_calls` column, as the one call that message made — the column the
 * schema already holds for a message's tool calls, so no migration is needed.
 */
const ASK_USER_CALL = 'ask_user'

const toToolCalls = (elicitation: AiMessageElicitation | undefined) =>
  elicitation === undefined ? {} : { toolCalls: [{ name: ASK_USER_CALL, elicitation }] }

/** The question a stored message asked, read back from its `tool_calls`. */
const elicitationOf = (toolCalls: unknown): { readonly elicitation?: AiMessageElicitation } => {
  const call: unknown = Array.isArray(toolCalls) ? toolCalls[0] : undefined
  if (typeof call !== 'object' || call === null) return {}
  const { name, elicitation } = call as { readonly name?: unknown; readonly elicitation?: unknown }
  if (name !== ASK_USER_CALL || typeof elicitation !== 'object' || elicitation === null) return {}
  const { message, state, server } = elicitation as Readonly<Record<string, unknown>>
  return typeof message === 'string' && state === 'cancelled'
    ? { elicitation: { message, state, ...(typeof server === 'string' && { server }) } }
    : {}
}

/** One stored part read back, or nothing when the stored value is not one. */
const partOf = (raw: unknown): readonly AiMessagePart[] => {
  if (typeof raw !== 'object' || raw === null) return []
  const { type, text, attachmentId, name } = raw as Record<string, unknown>
  if (type === 'text' && typeof text === 'string') return [{ type, text }]
  if ((type === 'file' || type === 'image') && typeof attachmentId === 'string') {
    return [{ type, attachmentId, name: typeof name === 'string' ? name : '' }]
  }
  return []
}

/** A stored message's `parts` column read back; absent for a message sent as text alone. */
const partsOf = (raw: unknown): { readonly parts?: readonly AiMessagePart[] } =>
  Array.isArray(raw) ? { parts: raw.flatMap(partOf) } : {}

/** Wrap a DB promise, adapting failures to AiMemoryDatabaseError. */
const wrap = makeDbWrap((cause) => new AiMemoryDatabaseError({ cause }))

/**
 * Derive a conversation title from the first user message.
 *
 * Keeps it short (a thread label, not the whole message) — truncates to 60
 * characters with an ellipsis. An AI memory spec only asserts the title is a
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
 * The conversation row of the caller's `(userId, sessionId)` thread, or
 * `undefined` when she owns none by that id.
 */
const ownedConversation = async (
  userId: string,
  sessionId: string
): Promise<{ readonly id: string; readonly agentName: string | null } | undefined> =>
  db
    .select({ id: aiConversations.id, agentName: aiConversations.agentName })
    .from(aiConversations)
    .where(and(eq(aiConversations.userId, userId), eq(aiConversations.sessionId, sessionId)))
    .limit(1)
    .then((rows) => rows[0])

/** Every message of one conversation, every branch, oldest first. */
const messagesOf = async (conversationId: string): Promise<ReadonlyArray<AiMemoryMessage>> =>
  db
    .select({
      id: aiMessages.id,
      parentId: aiMessages.parentId,
      role: aiMessages.role,
      content: aiMessages.content,
      status: aiMessages.status,
      createdAt: aiMessages.createdAt,
      toolCalls: aiMessages.toolCalls,
      parts: aiMessages.parts,
    })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id))
    .then((rows) =>
      rows.map(({ toolCalls, parts, ...row }) => ({
        ...row,
        ...elicitationOf(toolCalls),
        ...partsOf(parts),
      }))
    )

/**
 * The tree of one conversation without its text: what deciding where a write
 * goes and when it is stamped needs, so a turn on a long thread does not read
 * every message back.
 */
const branchNodesOf = async (
  conversationId: string
): Promise<ReadonlyArray<BranchNode & { readonly role: string }>> =>
  db
    .select({
      id: aiMessages.id,
      parentId: aiMessages.parentId,
      role: aiMessages.role,
      createdAt: aiMessages.createdAt,
    })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))

/** One message of a chain {@link insertChain} writes. */
interface ChainMessage {
  /** The id to write the message under; minted here when absent. */
  readonly id?: string | undefined
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly model?: string | undefined
  /** A question the message asked that was cancelled, kept in its `tool_calls`. */
  readonly elicitation?: AiMessageElicitation | undefined
  /** A user message sent as parts: its parts, as references. */
  readonly parts?: ReadonlyArray<AiMessagePart> | undefined
}

/**
 * Write `chain` below `parentId`, each message following the one before it.
 *
 * Ids are minted here, not left to the column default, because each message
 * names the one before it as its parent. `created_at` is stamped EXPLICITLY,
 * one millisecond apart and after every message already in the conversation,
 * rather than left to the column default: the default gives a batch the SAME
 * instant (Postgres' `now()` is the transaction timestamp; two `new Date()`
 * calls land in one millisecond), and every reader orders by `created_at`.
 * Ordering belongs in the data — the answer happens after the question, and a
 * new sibling is the newest of its siblings, which is what makes it current.
 */
const insertChain = async (
  conversationId: string,
  write: {
    readonly parentId: string | null
    readonly chain: ReadonlyArray<ChainMessage>
    /** The conversation's messages as they stand ({@link branchNodesOf}). */
    readonly existing: ReadonlyArray<BranchNode>
  }
): Promise<ReadonlyArray<string>> => {
  const { parentId, chain, existing } = write
  if (chain.length === 0) return []
  const firstAt = nextInstant(existing, Date.now())
  const ids = chain.map((message) => message.id ?? crypto.randomUUID())
  const rows = chain.map((message, index) => ({
    id: ids[index] ?? crypto.randomUUID(),
    conversationId,
    parentId: index === 0 ? parentId : (ids[index - 1] ?? null),
    role: message.role,
    content: message.content,
    status: 'complete',
    createdAt: new Date(firstAt + index),
    ...(message.model !== undefined ? { model: message.model } : {}),
    ...(message.parts !== undefined ? { parts: message.parts } : {}),
    ...toToolCalls(message.elicitation),
  }))
  await db.insert(aiMessages).values(rows)
  return ids
}

/**
 * AI Memory Repository Implementation (Drizzle).
 *
 * Persists chat turns to `system.ai_conversations` / `system.ai_messages`.
 * `ai_messages.conversation_id` has `ON DELETE CASCADE`, so deleting a
 * conversation removes all its messages without an explicit message delete.
 */
export const AiMemoryRepositoryLive = Layer.succeed(AiMemoryRepository, {
  recordTurn: ({
    userId,
    sessionId,
    userMessage,
    assistantReply,
    agentName,
    model,
    assistantElicitation,
    parentId,
    ids,
    userParts,
  }) =>
    wrap(async (): Promise<void> => {
      const conversationId = await ensureConversation({
        userId,
        sessionId,
        firstMessage: userMessage,
        agentName,
      })
      // A new turn continues the branch it was asked on: below the message it
      // names when that message is an ANSWER of this thread (never another
      // thread's, and never a question, which would chain two questions), else
      // the thread's CURRENT branch.
      const existing = await branchNodesOf(conversationId)
      const named = existing.find((node) => node.id === parentId && node.role === 'assistant')
      await insertChain(conversationId, {
        parentId: named?.id ?? currentLeaf(existing)?.id ?? null,
        chain: [
          { id: ids?.question, role: 'user', content: userMessage, parts: userParts },
          {
            id: ids?.answer,
            role: 'assistant',
            content: assistantReply,
            model,
            elicitation: assistantElicitation,
          },
        ],
        existing,
      })
    }),

  getThread: ({ userId, sessionId }) =>
    wrap(async (): Promise<AiMemoryThread | undefined> => {
      const conversation = await ownedConversation(userId, sessionId)
      if (conversation === undefined) return undefined
      return { agentName: conversation.agentName, messages: await messagesOf(conversation.id) }
    }),

  appendBranch: ({ userId, sessionId, parentId, messages }) =>
    wrap(async (): Promise<ReadonlyArray<string>> => {
      const conversation = await ownedConversation(userId, sessionId)
      if (conversation === undefined) return []
      const ids = await insertChain(conversation.id, {
        parentId,
        chain: messages,
        existing: await branchNodesOf(conversation.id),
      })
      await db
        .update(aiConversations)
        .set({ updatedAt: new Date() })
        .where(eq(aiConversations.id, conversation.id))
      return ids
    }),

  listConversations: ({ userId, agentName, limit, offset }) =>
    wrap(async () => {
      const scope = and(
        eq(aiConversations.userId, userId),
        agentName === undefined ? undefined : eq(aiConversations.agentName, agentName)
      )
      const page = db
        .select({
          id: aiConversations.id,
          sessionId: aiConversations.sessionId,
          title: aiConversations.title,
          agentName: aiConversations.agentName,
          createdAt: aiConversations.createdAt,
          updatedAt: aiConversations.updatedAt,
        })
        .from(aiConversations)
        .where(scope)
        .orderBy(desc(aiConversations.updatedAt), desc(aiConversations.id))
        .limit(limit)
        .offset(offset)
      // One after the other: a request path on the shared pool.
      const conversations = await page
      const totals = await db.select({ total: count() }).from(aiConversations).where(scope)
      return { conversations, total: Number(totals[0]?.total ?? 0) }
    }),

  deleteConversation: ({ userId, sessionId }) =>
    wrap(() =>
      db
        .delete(aiConversations)
        .where(and(eq(aiConversations.userId, userId), eq(aiConversations.sessionId, sessionId)))
        .returning({ id: aiConversations.id })
        .then((removed) => removed.length > 0)
    ),

  listExpired: ({ userId, maxAgeDays }) =>
    wrap(async () => {
      const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
      const expired = await db
        .select({ sessionId: aiConversations.sessionId })
        .from(aiConversations)
        .where(and(eq(aiConversations.userId, userId), lt(aiConversations.updatedAt, cutoff)))
      return expired.flatMap((row) => (row.sessionId === null ? [] : [row.sessionId]))
    }),

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
