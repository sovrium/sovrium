/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { StoredToolCall } from '@/domain/models/app/agents/stored-tool-call-service'
import type { Effect } from 'effect'

/**
 * Database error for AI memory operations.
 *
 * Wraps any failure raised while reading or writing the
 * `system.ai_conversations` / `system.ai_messages` tables. The chat route
 * treats persistence as best-effort — a failure here never breaks the chat
 * turn — so this error is normally caught and discarded at the call site.
 */
export class AiMemoryDatabaseError extends Data.TaggedError('AiMemoryDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * A single persisted chat message (port-level shape).
 *
 * Structurally compatible with the Drizzle `ai_messages` row inference but
 * declared here so the application layer never imports from infrastructure.
 */
export interface AiMemoryMessage {
  readonly id: string
  /** The message this one follows in its branch; `null` for a first message. */
  readonly parentId: string | null
  readonly role: string
  readonly content: string
  readonly status: string
  readonly createdAt: Date
  /** On an assistant message: the question the agent asked there, and how it ended. */
  readonly elicitation?: AiMessageElicitation | undefined
  /** On a user message sent as parts: the parts, in the order sent, as references. */
  readonly parts?: ReadonlyArray<AiMessagePart> | undefined
}

/**
 * One part of a stored user message: its text, or a REFERENCE to an upload by
 * id. Never the bytes, the extracted text, a bucket or a storage key. The
 * upload's name is kept so a turn that replays the file after the upload is
 * erased can still say which file it was.
 */
export type AiMessagePart =
  | { readonly type: 'text'; readonly text: string }
  | {
      readonly type: 'image' | 'file'
      readonly attachmentId: string
      readonly name: string
    }

/**
 * A question an agent asked the person (`ask_user`), kept with the assistant
 * message of the turn it paused: its words and how it ended (`cancelled`, the
 * one state a paused turn is saved in — an answered question resumes the turn,
 * whose answer is saved instead).
 */
export interface AiMessageElicitation {
  readonly message: string
  readonly state: 'cancelled'
  /** The declared name of the external MCP server that asked; absent for the agent's own question. */
  readonly server?: string | undefined
}

/** One conversation thread and all its messages, every branch. */
export interface AiMemoryThread {
  /** The declared agent the thread was held with; `null` for the generic chat. */
  readonly agentName: string | null
  readonly messages: ReadonlyArray<AiMemoryMessage>
}

/**
 * A conversation thread summary (port-level shape) for the list endpoint.
 */
export interface AiMemoryConversationSummary {
  readonly id: string
  readonly sessionId: string | null
  readonly title: string | null
  readonly agentName: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * AI Memory Repository Port.
 *
 * Backs durable chat persistence:
 * `system.ai_conversations` holds one row per `(userId, sessionId)` thread,
 * `system.ai_messages` holds every user/assistant message in chronological
 * order.
 *
 * `recordTurn` is the primary write primitive — it upserts the conversation
 * row for the session and appends the user + assistant message pair in a
 * single call. `appendMessage` persists a single message (used by the
 * streaming path, where the assistant message is only known once the stream
 * completes). All reads are scoped by `userId` so users only see their own
 * conversations.
 */
export class AiMemoryRepository extends Context.Service<
  AiMemoryRepository,
  {
    /**
     * Persist a completed user/assistant exchange. Upserts the conversation
     * row for `(userId, sessionId)` — creating it (and auto-deriving a title
     * from the first user message) on the first turn, bumping `updatedAt`
     * afterwards — then appends the user message and the assistant reply below
     * `parentId` when it is a message of the thread, else at the end of the
     * thread's current branch.
     */
    readonly recordTurn: (input: {
      readonly userId: string
      readonly sessionId: string
      readonly userMessage: string
      readonly assistantReply: string
      readonly agentName?: string
      readonly model?: string
      /** The question the assistant message asked, for a turn saved while paused on it. */
      readonly assistantElicitation?: AiMessageElicitation
      /** What the answer's turn ran, one line per call — never its arguments or result. */
      readonly assistantToolCalls?: ReadonlyArray<StoredToolCall>
      /**
       * The message the turn follows — the end of the branch it was asked on.
       * Absent, or not a message of this conversation: the current branch.
       */
      readonly parentId?: string | undefined
      /** The ids to write the question and its answer under, minted by the caller. */
      readonly ids?: { readonly question: string; readonly answer: string } | undefined
      /** The user message's parts, for a message sent as parts. */
      readonly userParts?: ReadonlyArray<AiMessagePart>
    }) => Effect.Effect<void, AiMemoryDatabaseError>
    /**
     * Return a `(userId, sessionId)` thread with EVERY message — every branch —
     * in chronological order, or `undefined` when the caller owns no thread by
     * that id. A thread is a tree (`parentId`); which branch is read is the
     * caller's decision (`conversation-branch-service.ts`).
     */
    readonly getThread: (input: {
      readonly userId: string
      readonly sessionId: string
    }) => Effect.Effect<AiMemoryThread | undefined, AiMemoryDatabaseError>
    /**
     * Append a chain of messages below `parentId` (`null`: a new first
     * message) in the caller's thread, each following the one before it, and
     * bump the thread's `updatedAt`. Every message is stamped after every
     * message already in the thread, so the chain is the newest branch.
     * Answers the ids written, in order — none when the caller owns no thread
     * by that id.
     */
    readonly appendBranch: (input: {
      readonly userId: string
      readonly sessionId: string
      readonly parentId: string | null
      readonly messages: ReadonlyArray<{
        readonly role: 'user' | 'assistant'
        readonly content: string
        readonly model?: string
        /** A question's parts, for one sent (or edited) as parts: references only. */
        readonly parts?: ReadonlyArray<AiMessagePart> | undefined
        /** An answer's calls, one line each — never their arguments or results. */
        readonly toolCalls?: ReadonlyArray<StoredToolCall> | undefined
      }>
    }) => Effect.Effect<ReadonlyArray<string>, AiMemoryDatabaseError>
    /**
     * List the conversation threads owned by `userId`, most-recently-updated
     * first, narrowed to one agent's threads when `agentName` is given, one
     * page at a time (`limit`, `offset`). `total` counts every matching thread.
     * Scoped per-user so a caller never sees another user's threads.
     */
    readonly listConversations: (input: {
      readonly userId: string
      readonly agentName?: string
      readonly limit: number
      readonly offset: number
    }) => Effect.Effect<
      {
        readonly conversations: ReadonlyArray<AiMemoryConversationSummary>
        readonly total: number
      },
      AiMemoryDatabaseError
    >
    /**
     * Delete a conversation (and, by ON DELETE CASCADE, all its messages) for
     * a `(userId, sessionId)` pair. Answers whether a thread was removed:
     * `false` when the caller owns no thread by that id.
     */
    readonly deleteConversation: (input: {
      readonly userId: string
      readonly sessionId: string
    }) => Effect.Effect<boolean, AiMemoryDatabaseError>
    /**
     * The session ids of the conversations {@link purgeExpired} would remove:
     * what the retention policy deletes the files of first.
     */
    readonly listExpired: (input: {
      readonly userId: string
      readonly maxAgeDays: number
    }) => Effect.Effect<ReadonlyArray<string>, AiMemoryDatabaseError>
    /**
     * Delete every conversation owned by `userId` whose `updatedAt` is older
     * than `maxAgeDays` days. Returns the number of threads removed. Drives
     * the `AI_MEMORY_MAX_AGE_DAYS` retention policy.
     */
    readonly purgeExpired: (input: {
      readonly userId: string
      readonly maxAgeDays: number
    }) => Effect.Effect<number, AiMemoryDatabaseError>
  }
>()('AiMemoryRepository') {}
