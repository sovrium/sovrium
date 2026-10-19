/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  AiMemoryRepository,
  type AiMemoryConversationSummary,
  type AiMemoryDatabaseError,
  type AiMemoryMessage,
  type AiMemoryThread,
  type AiMessagePart,
  type AiMessageElicitation,
} from '@/application/ports/repositories/ai/ai-memory-repository'
import { deleteConversationAttachments } from '@/application/use-cases/ai/chat-attachments'
import { currentBranch } from '@/domain/models/app/agents/conversation-branch-service'
import type {
  ChatAttachmentDatabaseError,
  ChatAttachmentRepository,
} from '@/application/ports/repositories/ai/chat-attachment-repository'
import type { StorageError, StorageService } from '@/application/ports/services/storage-service'
import type { StoredToolCall } from '@/domain/models/app/agents/stored-tool-call-service'

/**
 * Application use-cases for durable AI chat memory.
 *
 * Each function is an `Effect.gen` program orchestrating the
 * `AiMemoryRepository` port — the presentation layer consumes them via
 * `Effect.runPromise`, the infrastructure layer supplies the live Drizzle
 * implementation. No direct database access happens here.
 */

/**
 * Persist a completed user/assistant chat exchange to durable storage,
 * upserting the conversation thread for `(userId, sessionId)`: below
 * `parentId` when the turn names the message it follows, else at the end of
 * the current branch.
 */
export const persistChatTurn = (input: {
  readonly userId: string
  readonly sessionId: string
  readonly userMessage: string
  readonly assistantReply: string
  readonly agentName?: string
  readonly model?: string
  readonly assistantElicitation?: AiMessageElicitation
  /** What the answer's turn ran, one line per call (`stored-tool-call-service.ts`). */
  readonly assistantToolCalls?: ReadonlyArray<StoredToolCall>
  readonly parentId?: string | undefined
  readonly ids?: { readonly question: string; readonly answer: string } | undefined
  readonly userParts?: ReadonlyArray<AiMessagePart>
}): Effect.Effect<void, AiMemoryDatabaseError, AiMemoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    yield* repo.recordTurn(input)
  }).pipe(Effect.withSpan('ai.persist-chat-turn'))

/**
 * Load the CURRENT branch of a `(userId, sessionId)` thread, in chronological
 * order: the history replayed to the model as prior turns. An edited question
 * or a regenerated answer has replaced what it was written in place of, so the
 * model never reads both.
 */
export const loadChatHistory = (input: {
  readonly userId: string
  readonly sessionId: string
}): Effect.Effect<ReadonlyArray<AiMemoryMessage>, AiMemoryDatabaseError, AiMemoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    const thread = yield* repo.getThread(input)
    return thread === undefined ? [] : currentBranch(thread.messages)
  }).pipe(Effect.withSpan('ai.load-chat-history'))

/**
 * Load a `(userId, sessionId)` thread with EVERY message, every branch: what
 * the conversation routes read a branch, its siblings, or the message being
 * edited from. `undefined` when the caller owns no thread by that id.
 */
export const loadConversationTree = (input: {
  readonly userId: string
  readonly sessionId: string
}): Effect.Effect<AiMemoryThread | undefined, AiMemoryDatabaseError, AiMemoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    return yield* repo.getThread(input)
  }).pipe(Effect.withSpan('ai.load-conversation-tree'))

/**
 * Write a new branch of a thread: `messages` below `parentId`, each following
 * the one before. An edited question is written below the edited message's
 * parent with its answer; a regenerated answer below its question. Answers the
 * ids written — none when the caller owns no thread by that id.
 */
export const recordConversationBranch = (input: {
  readonly userId: string
  readonly sessionId: string
  readonly parentId: string | null
  readonly messages: ReadonlyArray<{
    readonly role: 'user' | 'assistant'
    readonly content: string
    readonly parts?: ReadonlyArray<AiMessagePart> | undefined
    readonly toolCalls?: ReadonlyArray<StoredToolCall> | undefined
  }>
}): Effect.Effect<ReadonlyArray<string>, AiMemoryDatabaseError, AiMemoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    return yield* repo.appendBranch(input)
  }).pipe(Effect.withSpan('ai.record-conversation-branch'))

/**
 * List the conversation threads owned by a user, most-recently-updated
 * first, optionally one agent's only, one page at a time.
 */
export const listUserConversations = (input: {
  readonly userId: string
  readonly agentName?: string
  readonly limit: number
  readonly offset: number
}): Effect.Effect<
  {
    readonly conversations: ReadonlyArray<AiMemoryConversationSummary>
    readonly total: number
  },
  AiMemoryDatabaseError,
  AiMemoryRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    return yield* repo.listConversations(input)
  }).pipe(Effect.withSpan('ai.list-user-conversations'))

/**
 * Delete a conversation thread and (by ON DELETE CASCADE) all its messages
 * Answers whether a thread was removed — `false` when
 * the caller owns no thread by that id, which the route answers as a 404.
 */
export const deleteUserConversation = (input: {
  readonly userId: string
  readonly sessionId: string
}): Effect.Effect<boolean, AiMemoryDatabaseError, AiMemoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    return yield* repo.deleteConversation(input)
  }).pipe(Effect.withSpan('ai.delete-user-conversation'))

/**
 * Apply the retention policy: delete every conversation owned by `userId`
 * whose `updatedAt` is older than `maxAgeDays` days, with the files sent in it
 * — their stored bytes and their rows, hard-deleted, as deleting the
 * conversation by hand does (S5). The files go first: a store that refuses a
 * delete fails the sweep before any conversation is removed, so the next sweep
 * asks again rather than leaving files no conversation holds.
 * Returns the number of threads removed.
 */
export const enforceRetentionPolicy = (input: {
  readonly userId: string
  readonly maxAgeDays: number
}): Effect.Effect<
  number,
  AiMemoryDatabaseError | ChatAttachmentDatabaseError | StorageError,
  AiMemoryRepository | ChatAttachmentRepository | StorageService
> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    const expired = yield* repo.listExpired(input)
    yield* Effect.forEach(
      expired,
      (sessionId) => deleteConversationAttachments({ userId: input.userId, sessionId }),
      { discard: true }
    )
    return yield* repo.purgeExpired(input)
  }).pipe(Effect.withSpan('ai.enforce-retention-policy'))
