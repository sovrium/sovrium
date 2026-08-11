/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for the **Agents Conversations** admin read endpoint family
 * (the ChatGPT-style conversation-history viewer):
 *
 *   - `GET /api/admin/agents/:name/conversations`     — cursor-paginated list of
 *     an agent's conversations, newest-first.
 *   - `GET /api/admin/agents/:name/conversations/:id` — a single conversation's
 *     messages, chronological.
 *
 * Powers the admin dashboard's `/_admin/data/agents` page. Backed by the
 * durable AI memory store (`system.ai_conversations` + `system.ai_messages`),
 * read CROSS-USER and AGENT-SCOPED (by the `agent_name` column the `recordTurn`
 * writer stamps when an agent drives the chat).
 *
 * Source story: [internal ref]
 *
 * **Why a sibling to metrics.ts**: `metrics.ts` is the per-agent rollup
 * (`{ totals, by_*, series }`) that powers the Agents Analytique tab. This is
 * the *content* drill-in: the Data tab where an operator reads the actual
 * conversation threads an agent held. They share the `/api/admin/agents/:name/*`
 * namespace and the `hasAgent` anti-enum 404, but the metrics endpoint answers
 * "how much did this agent run" while this one answers "what did it actually
 * say".
 *
 * **PII posture (S4)**: these schemas are the single shaping choke point — the
 * response carries ONLY the operator-facing fields below. The list item
 * deliberately OMITS `userId` (the operator view is conversation-content
 * focused, not a per-user audit), `agentId` (unused by writers), and `metadata`
 * (internal store bookkeeping). The detail messages expose `role`, `content`,
 * `status`, `model`, `tokenCount`, and `toolCalls` — the chat-transcript fields
 * — but never `conversationId` or the raw row.
 *
 * **No `_admin` envelope**: a conversation/message has no public counterpart
 * (chat history is never publicly listed), so there is nothing to be a superset
 * of ([internal ref] D3 rationale, same as the bucket-file item). Both shapes are flat
 * admin-only projections.
 *
 * @see ./metrics.ts — sibling per-agent rollup endpoint
 * @see ../../_shared/cursor-pagination.ts — opaque base64 cursor contract
 * @see ../audit-log/action-catalog.ts — `agent.conversation.list.queried` /
 *      `agent.conversation.detail.queried` (resource.type `agent`)
 */

import { z } from '@hono/zod-openapi'
import { cursorPaginationQuerySchema, cursorPaginationResponseSchema } from '../../_shared'

/**
 * A single conversation row in the list. Flat projection of
 * `system.ai_conversations` joined with the message count — admin-only, no
 * public counterpart, so no `_admin` envelope (see file-level docstring).
 *
 * Field selection is the operator's at-a-glance triage set: the conversation
 * `id` (the path segment the detail endpoint resolves by), the human `title`
 * (auto-generated from the first user message), the `sessionId` (the durable
 * store's `(userId, sessionId)` thread key), the `messageCount` (how long the
 * exchange ran), `lastActivityAt` (= the conversation's `updatedAt`, the column
 * the list orders + the cursor seeks on), and the `createdAt` open timestamp.
 */
export const agentConversationListItemSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .describe(
        'Unique conversation id (`ai_conversations.id`, a uuid). The path segment the conversation-detail endpoint resolves by. Doubles as the deterministic cursor tie-break.'
      ),
    title: z
      .string()
      .nullable()
      .describe(
        'Human conversation title (`ai_conversations.title`), auto-generated from the first user message. `null` when the store has not titled the thread yet — the dashboard falls back to the sessionId or a "(untitled)" label.'
      ),
    sessionId: z
      .string()
      .nullable()
      .describe(
        "The durable store's session key (`ai_conversations.session_id`) — half of the `(userId, sessionId)` thread identity. `null` for conversations created without a session id."
      ),
    messageCount: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Number of messages in this conversation (`COUNT(ai_messages.id)` for the conversation). Lets the operator gauge thread length without opening it.'
      ),
    lastActivityAt: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp of the last activity (`ai_conversations.updated_at`). The column the list orders by (newest-first) and the cursor seeks on.'
      ),
    createdAt: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp the conversation was opened (`ai_conversations.created_at`).'
      ),
  })
  .openapi('AgentConversationListItem')

/**
 * Query schema for `GET /api/admin/agents/:name/conversations`.
 *
 * Extends the canonical cursor-pagination contract (`cursor`, `limit` —
 * default 50, max 200) with an OPTIONAL `updatedAt` date window:
 *
 * - `from` — optional ISO 8601 lower bound (inclusive) on `lastActivityAt`.
 * - `to`   — optional ISO 8601 upper bound (inclusive) on `lastActivityAt`.
 *
 * Both omitted = "all time". The bounds filter on the same `updated_at` column
 * the list orders + the cursor seeks on, so a date window composes cleanly with
 * pagination (the cursor never escapes the window).
 */
export const agentConversationsListQuerySchema = cursorPaginationQuerySchema.extend({
  from: z
    .string()
    .datetime()
    .optional()
    .describe(
      'Optional inclusive ISO 8601 lower bound on `lastActivityAt` (the conversation `updated_at`). Omit for no lower bound.'
    ),
  to: z
    .string()
    .datetime()
    .optional()
    .describe(
      'Optional inclusive ISO 8601 upper bound on `lastActivityAt` (the conversation `updated_at`). Omit for no upper bound.'
    ),
})

/**
 * Response schema for `GET /api/admin/agents/:name/conversations`.
 *
 * The canonical cursor-paginated envelope (`items`, `nextCursor`) of
 * conversation list items, ordered newest-first by `lastActivityAt` with `id`
 * as the deterministic tie-break.
 */
export const agentConversationsListResponseSchema = cursorPaginationResponseSchema(
  agentConversationListItemSchema
).openapi('AgentConversationsListResponse')

/**
 * A single message in a conversation transcript. Flat projection of
 * `system.ai_messages` — admin-only, no public counterpart, so no `_admin`
 * envelope. `conversationId` is NOT exposed (it is the request path segment;
 * echoing it back is redundant + leaks the join key).
 */
export const agentConversationMessageSchema = z
  .object({
    id: z.string().min(1).describe('Unique message id (`ai_messages.id`).'),
    role: z
      .enum(['user', 'assistant', 'tool'])
      .describe(
        'Author of the message (`ai_messages.role`): `user` (the human), `assistant` (the agent), or `tool` (a tool-call result turn).'
      ),
    content: z
      .string()
      .describe(
        'Message body (`ai_messages.content`). The raw chat text — surfaced verbatim to the operator reviewing the transcript. May be empty for a pure tool-call turn.'
      ),
    status: z
      .enum(['complete', 'incomplete'])
      .describe(
        'Delivery status (`ai_messages.status`): `complete` for buffered/fully-streamed turns; `incomplete` when a streamed assistant response was interrupted before the terminal marker. User messages are always `complete`.'
      ),
    model: z
      .string()
      .nullable()
      .describe(
        'The model that produced an assistant message (`ai_messages.model`), e.g. `gpt-4o`, `llama3`. `null` for user/tool turns and for turns where no model was recorded.'
      ),
    tokenCount: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe(
        'Token count attributed to the message (`ai_messages.token_count`). `null` when the store did not record a count for the turn.'
      ),
    toolCalls: z
      .unknown()
      .nullable()
      .describe(
        'Structured tool-call payload for an assistant/tool turn (`ai_messages.tool_calls`, jsonb). `null` for plain text turns. Opaque JSON — the dashboard renders it as a collapsible tool-call panel.'
      ),
    createdAt: z
      .string()
      .datetime()
      .describe('ISO 8601 UTC timestamp the message was recorded (`ai_messages.created_at`).'),
  })
  .openapi('AgentConversationMessage')

/**
 * The conversation header echoed alongside the messages in the detail response.
 * A subset of the list item (no `messageCount` — the operator counts the
 * `messages` array directly on the detail screen).
 */
export const agentConversationHeaderSchema = z
  .object({
    id: z.string().min(1).describe('Unique conversation id (`ai_conversations.id`).'),
    title: z
      .string()
      .nullable()
      .describe('Human conversation title (`ai_conversations.title`); `null` when untitled.'),
    sessionId: z
      .string()
      .nullable()
      .describe(
        "The durable store's session key (`ai_conversations.session_id`); `null` when absent."
      ),
    createdAt: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp the conversation was opened (`ai_conversations.created_at`).'
      ),
    lastActivityAt: z
      .string()
      .datetime()
      .describe('ISO 8601 UTC timestamp of the last activity (`ai_conversations.updated_at`).'),
  })
  .openapi('AgentConversationHeader')

/**
 * Response schema for `GET /api/admin/agents/:name/conversations/:id`.
 *
 * The conversation `header` plus its `messages` array ordered chronologically
 * (`createdAt` ascending) — exactly how a transcript reads top-to-bottom in the
 * ChatGPT-style viewer.
 */
export const agentConversationDetailResponseSchema = z
  .object({
    conversation: agentConversationHeaderSchema.describe('The conversation header.'),
    messages: z
      .array(agentConversationMessageSchema)
      .describe('Every message in the conversation, ordered chronologically (oldest first).'),
  })
  .openapi('AgentConversationDetailResponse')

/**
 * TypeScript types inferred from the schemas.
 * @public
 */
export type AgentConversationListItem = z.infer<typeof agentConversationListItemSchema>
/** @public */
export type AgentConversationsListQuery = z.infer<typeof agentConversationsListQuerySchema>
/** @public */
export type AgentConversationsListResponse = z.infer<typeof agentConversationsListResponseSchema>
export type AgentConversationMessage = z.infer<typeof agentConversationMessageSchema>
/** @public */
export type AgentConversationHeader = z.infer<typeof agentConversationHeaderSchema>
/** @public */
export type AgentConversationDetailResponse = z.infer<typeof agentConversationDetailResponseSchema>
