/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'
import { cursorPaginationQuerySchema, cursorPaginationResponseSchema } from '../../_shared'

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

export const agentConversationsListResponseSchema = cursorPaginationResponseSchema(
  agentConversationListItemSchema
).openapi('AgentConversationsListResponse')

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

export const agentConversationDetailResponseSchema = z
  .object({
    conversation: agentConversationHeaderSchema.describe('The conversation header.'),
    messages: z
      .array(agentConversationMessageSchema)
      .describe('Every message in the conversation, ordered chronologically (oldest first).'),
  })
  .openapi('AgentConversationDetailResponse')

export type AgentConversationListItem = z.infer<typeof agentConversationListItemSchema>
export type AgentConversationsListQuery = z.infer<typeof agentConversationsListQuerySchema>
export type AgentConversationsListResponse = z.infer<typeof agentConversationsListResponseSchema>
export type AgentConversationMessage = z.infer<typeof agentConversationMessageSchema>
export type AgentConversationHeader = z.infer<typeof agentConversationHeaderSchema>
export type AgentConversationDetailResponse = z.infer<typeof agentConversationDetailResponseSchema>
