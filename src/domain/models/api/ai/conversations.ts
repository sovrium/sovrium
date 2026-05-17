/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Conversation summary schema
// ---------------------------------------------------------------------------

/**
 * Summary of a conversation thread for list views.
 */
export const conversationSummarySchema = z.object({
  sessionId: z.string().describe('Unique session identifier for the conversation'),
  title: z.string().nullable().describe('Auto-generated title from the first user message'),
  agentName: z
    .string()
    .nullable()
    .describe('Agent name if conversation is with a specific agent (null for default AI)'),
  messageCount: z.number().int().min(0).describe('Total number of messages in the conversation'),
  createdAt: z.string().datetime().describe('ISO 8601 timestamp when the conversation started'),
  updatedAt: z.string().datetime().describe('ISO 8601 timestamp of the most recent message'),
})

// ---------------------------------------------------------------------------
// Conversation message schema
// ---------------------------------------------------------------------------

/**
 * A single message within a conversation thread.
 */
export const conversationMessageSchema = z.object({
  id: z.number().int().describe('Message identifier'),
  role: z.enum(['user', 'assistant', 'system']).describe('Role of the message sender'),
  content: z.string().describe('Message text content'),
  actions: z
    .array(z.record(z.string(), z.unknown()))
    .describe('Actions taken by the AI during this message'),
  tokenUsage: z
    .object({
      prompt: z.number().int().describe('Prompt tokens consumed'),
      completion: z.number().int().describe('Completion tokens consumed'),
      total: z.number().int().describe('Total tokens consumed'),
    })
    .optional()
    .describe('Token usage for assistant messages'),
  createdAt: z.string().datetime().describe('ISO 8601 timestamp when the message was created'),
})

// ---------------------------------------------------------------------------
// Conversation list response schema
// ---------------------------------------------------------------------------

/**
 * Response schema for listing conversation threads.
 */
export const conversationListResponseSchema = z.object({
  conversations: z
    .array(conversationSummarySchema)
    .describe('List of conversation thread summaries'),
  total: z.number().int().min(0).describe('Total number of conversations'),
})

// ---------------------------------------------------------------------------
// Conversation detail response schema
// ---------------------------------------------------------------------------

/**
 * Response schema for retrieving a single conversation with its messages.
 */
export const conversationDetailResponseSchema = z.object({
  conversation: conversationSummarySchema.describe('Conversation thread metadata'),
  messages: z
    .array(conversationMessageSchema)
    .describe('Ordered list of messages in the conversation'),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type ConversationSummary = z.infer<typeof conversationSummarySchema>
export type ConversationMessage = z.infer<typeof conversationMessageSchema>
export type ConversationListResponse = z.infer<typeof conversationListResponseSchema>
export type ConversationDetailResponse = z.infer<typeof conversationDetailResponseSchema>
