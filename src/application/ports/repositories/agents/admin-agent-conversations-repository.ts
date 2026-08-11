/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Admin Agent Conversations Repository Port
 *
 * Type-safe data access backing the **Agents Conversations** admin read endpoint
 * family (`GET /api/admin/agents/:name/conversations` + `.../:id`). Three reads
 * over the durable AI memory store (`system.ai_conversations` +
 * `system.ai_messages`), all CROSS-USER and AGENT-SCOPED by the
 * `ai_conversations.agent_name` column (the `recordTurn` writer stamps it when
 * an agent drives the chat):
 *
 *   - {@link listConversations} — a cursor-paginated, newest-first scan of an
 *     agent's conversations, each annotated with its message count, optionally
 *     windowed by an `updatedAt` (`lastActivityAt`) date range. Sort + cursor
 *     seek deterministically on the `(updatedAt, id)` tuple so two conversations
 *     with the same `updatedAt` never collapse into one cursor position.
 *   - {@link getConversation} — the conversation header for a single
 *     `(agentName, conversationId)` pair, scoped by `agent_name` so a
 *     conversation that belongs to a DIFFERENT agent resolves to `undefined`
 *     (the use case maps that to the anti-enum 404). Returns `undefined` when no
 *     such conversation exists for this agent.
 *   - {@link listMessages} — every message of a conversation, ordered
 *     chronologically (`created_at` ascending).
 *
 * This is a deliberately separate port from the existing per-user
 * `AiMemoryRepository` (which reads `(userId, sessionId)`-keyed history for the
 * chatting user): the admin view is cross-user and agent-scoped, with cursor
 * pagination + a date window + a message-count annotation — none of which the
 * per-user memory port exposes. Same judgement cluster as the admin-forms vs
 * form-submission write port, and the admin-bucket-files vs StorageService port.
 *
 * The row + filter types below are decoupled from Drizzle so the application
 * layer stays free of an infrastructure dependency. `updatedAt` / `createdAt`
 * stay dialect-native (`Date | string`: Postgres returns `Date`, SQLite a
 * number/Date depending on the driver) so the use case owns ISO 8601
 * normalization. Implementation lives in the infrastructure layer
 * (admin-agent-conversations-repository-live.ts — to be authored by the
 * implementer).
 */

/**
 * Database error for admin agent-conversations read operations.
 */
export class AdminAgentConversationsDatabaseError extends Data.TaggedError(
  'AdminAgentConversationsDatabaseError'
)<{
  readonly cause: unknown
}> {}

/**
 * Raw conversation row used by the conversation list, annotated with its message
 * count. Mirrors the `ai_conversations` projection joined with
 * `COUNT(ai_messages.id)`. `updatedAt` / `createdAt` stay dialect-native; `id`
 * is the unique conversation id (also the cursor tie-breaker). `userId`,
 * `agentId`, and `metadata` are intentionally NOT projected — the use case must
 * not have them available to leak (S4).
 */
export interface AdminAgentConversationRow {
  readonly id: string
  readonly title: string | null
  readonly sessionId: string | null
  readonly messageCount: number
  readonly updatedAt: Date | string
  readonly createdAt: Date | string
}

/**
 * Raw message row used by the conversation transcript. Mirrors the
 * `ai_messages` projection. `conversationId` is NOT projected — it is the
 * request path segment, not a response field. `toolCalls` is the dialect-native
 * jsonb/json value (already-parsed object/array or `null`).
 */
export interface AdminAgentMessageRow {
  readonly id: string
  readonly role: string
  readonly content: string
  readonly status: string
  readonly model: string | null
  readonly tokenCount: number | null
  readonly toolCalls: unknown
  readonly createdAt: Date | string
}

/**
 * Resolved WHERE / ORDER inputs for the conversation-list reader. The use case
 * parses + validates the raw query string (and decodes the opaque cursor) into
 * this shape; the repository turns it into dialect-aware drizzle predicates.
 *
 * - `agentName` — the `:name` path segment. Scopes the scan to one agent's
 *   conversations (`ai_conversations.agent_name = agentName`).
 * - `from` / `to` — optional inclusive ISO 8601 bounds on `updatedAt`
 *   (`lastActivityAt`). The use case passes the raw ISO strings; the repository
 *   coerces them to the column's native type for the bound parameter.
 * - `cursor` — the decoded `(value, id)` tuple from the opaque cursor, where
 *   `value` is the last row's `updatedAt` ISO; the repository emits the
 *   dialect-aware newest-first seek predicate for it.
 * - `limit` — the page size; the repository fetches `limit + 1` rows so the use
 *   case can compute `hasMore` / `nextCursor`.
 */
export interface AdminAgentConversationsListFilters {
  readonly agentName: string
  readonly from?: string | undefined
  readonly to?: string | undefined
  readonly cursor?: { readonly value: string; readonly id: string } | undefined
  readonly limit: number
}

export class AdminAgentConversationsRepository extends Context.Tag(
  'AdminAgentConversationsRepository'
)<
  AdminAgentConversationsRepository,
  {
    /**
     * Cursor-paginated, newest-first conversation scan for one agent. Fetches
     * `filters.limit + 1` rows ordered by the `(updatedAt, id)` tuple descending
     * (newest first), each annotated with its message count, applying the
     * optional `from`/`to` date window immutably. The extra row lets the use
     * case derive `hasMore` / `nextCursor`.
     */
    readonly listConversations: (
      filters: AdminAgentConversationsListFilters
    ) => Effect.Effect<readonly AdminAgentConversationRow[], AdminAgentConversationsDatabaseError>

    /**
     * Fetch the conversation header for a single `(agentName, conversationId)`
     * pair. Scoped by `agent_name` so a conversation belonging to a DIFFERENT
     * agent (or no agent) resolves to `undefined` — the use case maps that to
     * the anti-enum 404. Returns `undefined` when no matching conversation
     * exists for this agent.
     */
    readonly getConversation: (
      agentName: string,
      conversationId: string
    ) => Effect.Effect<AdminAgentConversationRow | undefined, AdminAgentConversationsDatabaseError>

    /**
     * Every message of a conversation, ordered chronologically
     * (`created_at` ascending). The caller has already verified the conversation
     * belongs to the agent via {@link getConversation}.
     */
    readonly listMessages: (
      conversationId: string
    ) => Effect.Effect<readonly AdminAgentMessageRow[], AdminAgentConversationsDatabaseError>
  }
>() {}
