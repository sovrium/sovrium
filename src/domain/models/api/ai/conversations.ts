/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { chatActionSchema, chatCitationsSchema } from '@/domain/models/api/ai/chat'
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
  messageCount: optionalField(
    Schema.Int.annotate({
      description: 'Total number of messages in the conversation',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
  ),
  createdAt: looseIsoDateTime({ description: 'ISO 8601 timestamp when the conversation started' }),
  updatedAt: looseIsoDateTime({ description: 'ISO 8601 timestamp of the most recent message' }),
})

// ---------------------------------------------------------------------------
// Conversation message parts
// ---------------------------------------------------------------------------

/**
 * One part of a stored message, as a reloaded conversation returns it.
 *
 * What is stored is the reference the user sent — the text, or the id of an
 * upload — never the file's bytes and never the text extracted from it. On the
 * way out, a file or image part is completed with the upload's name and type,
 * read from the caller's own uploads; a part whose upload no longer exists
 * comes back with its id alone.
 */
export const conversationMessagePartSchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('text').annotate({ description: 'A block of text the user wrote' }),
    text: Schema.String.annotate({ description: 'The text of the part' }),
  }).annotate({ description: 'A text part' }),
  Schema.Struct({
    type: Schema.Literals(['image', 'file']).annotate({
      description: 'An uploaded picture or document',
    }),
    attachmentId: Schema.String.annotate({ description: 'The id of the upload' }),
    name: optionalField(
      Schema.String.annotate({ description: 'The file name as uploaded, while the upload exists' })
    ),
    mimeType: optionalField(
      Schema.String.annotate({
        description: 'The media type read from the file content, while the upload exists',
      })
    ),
  }).annotate({ description: 'A reference to an upload' }),
]).annotate({ description: 'One part of a stored message' })

// ---------------------------------------------------------------------------
// Conversation message schema
// ---------------------------------------------------------------------------

/**
 * A single message of a conversation's branch.
 *
 * A conversation is a tree: editing a question or regenerating an answer adds a
 * sibling instead of overwriting. A message with alternatives lists them all in
 * `siblings` (itself included, oldest first), which is what a reader pages
 * through ("2 / 3").
 */
export const conversationMessageSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Message identifier' }),
  role: Schema.Literals(['user', 'assistant', 'system']).annotate({
    description: 'Role of the message sender',
  }),
  content: Schema.String.annotate({ description: 'Message text content' }),
  html: optionalField(
    Schema.String.annotate({
      description: "An assistant message's Markdown rendered to sanitized HTML",
    })
  ),
  status: optionalField(
    Schema.Literals(['complete', 'incomplete']).annotate({
      description: '`incomplete` when a streamed answer was interrupted before it ended',
    })
  ),
  siblings: optionalField(
    Schema.Array(Schema.String).annotate({
      description:
        'Present when the message has alternatives: the ids of every message written in its place, itself included, oldest first',
    })
  ),
  parts: optionalField(
    Schema.Array(conversationMessagePartSchema).annotate({
      description:
        'The parts of a message sent as parts, in the order they were sent; absent for a message sent as text alone',
    })
  ),
  actions: optionalField(
    Schema.Array(Schema.Record(Schema.String, Schema.Unknown)).annotate({
      description: 'Actions taken by the AI during this message',
    })
  ),
  elicitation: optionalField(
    Schema.Struct({
      message: Schema.String.annotate({ description: 'The question the agent asked' }),
      state: Schema.Literal('cancelled').annotate({
        description: 'How the question ended: cancelled, the person sent a new message instead',
      }),
      server: optionalField(
        Schema.String.annotate({
          description:
            'The declared name of the external MCP server that asked, for a question relayed from one; absent for the agent own question',
        })
      ),
    }).annotate({
      description:
        'On an assistant message: a question the agent asked that was cancelled, so the turn stopped there',
    })
  ),
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
 * Response schema for reading a conversation: one branch of it, the current
 * one unless `?branch=<messageId>` names a message the branch must run through.
 */
export const conversationDetailResponseSchema = Schema.Struct({
  sessionId: Schema.String.annotate({ description: 'Conversation session identifier' }),
  messages: Schema.Array(conversationMessageSchema).annotate({
    description: 'The messages of the branch read, oldest first',
  }),
})

/** Query parameters of the conversation list. */
export const conversationListQuerySchema = Schema.Struct({
  agent: optionalField(Schema.String.annotate({ description: "Only this agent's conversations" })),
  limit: optionalField(Schema.String.annotate({ description: 'Page size, 1 to 100 (default 50)' })),
  offset: optionalField(
    Schema.String.annotate({ description: 'Number of conversations to skip (default 0)' })
  ),
})

/** Query parameters of a conversation read. */
export const conversationDetailQuerySchema = Schema.Struct({
  branch: optionalField(
    Schema.String.annotate({
      description: 'A message id: read the branch through it instead of the current one',
    })
  ),
})

/** Request body of `POST /api/ai/conversations/{sessionId}/messages/{messageId}/edit`. */
export const conversationEditRequestSchema = Schema.Struct({
  content: Schema.String.annotate({ description: 'The new text of the question' }).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
})

/**
 * Response of an edit or a regeneration: the agent's new answer, and the
 * conversation's branch now current, which holds it.
 */
export const conversationTurnResponseSchema = Schema.Struct({
  sessionId: Schema.String.annotate({ description: 'Conversation session identifier' }),
  reply: Schema.String.annotate({ description: "The agent's new answer" }),
  actions: Schema.Array(chatActionSchema).annotate({
    description: 'Actions taken by the AI while answering',
  }),
  citations: optionalField(chatCitationsSchema),
  messages: Schema.Array(conversationMessageSchema).annotate({
    description: 'The current branch, which ends with the new answer',
  }),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type ConversationSummary = typeof conversationSummarySchema.Type
export type ConversationMessage = typeof conversationMessageSchema.Type
/** @public */
export type ConversationMessagePart = typeof conversationMessagePartSchema.Type
export type ConversationListResponse = typeof conversationListResponseSchema.Type
export type ConversationDetailResponse = typeof conversationDetailResponseSchema.Type
export type ConversationTurnResponse = typeof conversationTurnResponseSchema.Type
