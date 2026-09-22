/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// Conversation summary schema
// ---------------------------------------------------------------------------

/**
 * Summary of a conversation thread for list views.
 */
export const conversationSummarySchema = Schema.Struct({
  sessionId: Schema.String.annotate({
    description: 'Unique session identifier for the conversation',
  }),
  title: Schema.NullOr(
    Schema.String.annotate({ description: 'Auto-generated title from the first user message' })
  ),
  agentName: Schema.NullOr(
    Schema.String.annotate({
      description: 'Agent name if conversation is with a specific agent (null for default AI)',
    })
  ),
  messageCount: Schema.Int.annotate({
    description: 'Total number of messages in the conversation',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  createdAt: looseIsoDateTime({ description: 'ISO 8601 timestamp when the conversation started' }),
  updatedAt: looseIsoDateTime({ description: 'ISO 8601 timestamp of the most recent message' }),
})

// ---------------------------------------------------------------------------
// Conversation message schema
// ---------------------------------------------------------------------------

/**
 * A single message within a conversation thread.
 */
export const conversationMessageSchema = Schema.Struct({
  id: Schema.Int.annotate({ description: 'Message identifier' }),
  role: Schema.Literals(['user', 'assistant', 'system']).annotate({
    description: 'Role of the message sender',
  }),
  content: Schema.String.annotate({ description: 'Message text content' }),
  actions: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)).annotate({
    description: 'Actions taken by the AI during this message',
  }),
  tokenUsage: optionalField(
    Schema.Struct({
      prompt: Schema.Int.annotate({ description: 'Prompt tokens consumed' }),
      completion: Schema.Int.annotate({ description: 'Completion tokens consumed' }),
      total: Schema.Int.annotate({ description: 'Total tokens consumed' }),
    }).annotate({ description: 'Token usage for assistant messages' })
  ),
  createdAt: looseIsoDateTime({ description: 'ISO 8601 timestamp when the message was created' }),
})

// ---------------------------------------------------------------------------
// Conversation list response schema
// ---------------------------------------------------------------------------

/**
 * Response schema for listing conversation threads.
 */
export const conversationListResponseSchema = Schema.Struct({
  conversations: Schema.Array(conversationSummarySchema).annotate({
    description: 'List of conversation thread summaries',
  }),
  total: Schema.Int.annotate({ description: 'Total number of conversations' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
})

// ---------------------------------------------------------------------------
// Conversation detail response schema
// ---------------------------------------------------------------------------

/**
 * Response schema for retrieving a single conversation with its messages.
 */
export const conversationDetailResponseSchema = Schema.Struct({
  conversation: conversationSummarySchema.annotate({ description: 'Conversation thread metadata' }),
  messages: Schema.Array(conversationMessageSchema).annotate({
    description: 'Ordered list of messages in the conversation',
  }),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type ConversationSummary = typeof conversationSummarySchema.Type
export type ConversationMessage = typeof conversationMessageSchema.Type
export type ConversationListResponse = typeof conversationListResponseSchema.Type
export type ConversationDetailResponse = typeof conversationDetailResponseSchema.Type
