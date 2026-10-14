/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  conversationDetailQuerySchema,
  conversationDetailResponseSchema,
  conversationEditRequestSchema,
  conversationListQuerySchema,
  conversationListResponseSchema,
  conversationTurnResponseSchema,
} from '@/domain/models/api/ai/conversations'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  effectJsonBody,
  effectJsonResponse,
  effectParameters,
} from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)
const sessionIdParam = Schema.Struct({
  sessionId: Schema.String.annotate({ description: 'Conversation session identifier' }),
})
const messageParams = Schema.Struct({
  sessionId: Schema.String.annotate({ description: 'Conversation session identifier' }),
  messageId: Schema.String.annotate({ description: 'Message identifier' }),
})
const turnResponses = {
  200: effectJsonResponse(conversationTurnResponseSchema, 'The new answer and the current branch'),
  400: errorResponse('Invalid request body'),
  401: errorResponse('Not authenticated'),
  404: errorResponse('Conversation or message not found'),
  429: errorResponse('Chat rate limit exceeded'),
  502: errorResponse('AI provider error'),
  500: errorResponse('Failed to save the conversation'),
}

/** AI conversation history route group. */
export const aiConversationGroup: StaticGroupSpec = {
  tag: 'AI',
  tagDescription: 'AI assistant, conversations, and retrieval-augmented generation',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/ai/conversations',
      summary: 'List AI conversations',
      description:
        "Returns the authenticated user's conversation threads, most recent activity first, one page at a time, optionally narrowed to one agent's.",
      operationIdBase: 'listAiConversations',
      parameters: effectParameters(conversationListQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(conversationListResponseSchema, 'Conversation list'),
        401: errorResponse('Not authenticated'),
        500: errorResponse('Failed to load conversations'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/ai/conversations/{sessionId}',
      summary: 'Get an AI conversation',
      description:
        'Returns one branch of a conversation: its current branch, or the one running through `branch`. A message with alternatives lists them in `siblings`.',
      operationIdBase: 'getAiConversation',

      parameters: [
        ...effectParameters(sessionIdParam, 'path'),
        ...effectParameters(conversationDetailQuerySchema, 'query'),
      ],
      responses: {
        200: effectJsonResponse(conversationDetailResponseSchema, 'Conversation detail'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('Conversation not found'),
        500: errorResponse('Failed to load conversation'),
      },
    },
    {
      method: 'delete',
      pathTemplate: '/api/ai/conversations/{sessionId}',
      summary: 'Delete an AI conversation',
      description: 'Deletes a conversation thread and all of its messages.',
      operationIdBase: 'deleteAiConversation',

      parameters: effectParameters(sessionIdParam, 'path'),
      responses: {
        200: effectJsonResponse(
          Schema.Struct({
            deleted: Schema.Boolean.annotate({
              description: 'Whether the conversation was deleted',
            }),
            sessionId: Schema.String.annotate({ description: 'Conversation session identifier' }),
          }),
          'Conversation deleted'
        ),
        401: errorResponse('Not authenticated'),
        404: errorResponse('Conversation not found'),
        500: errorResponse('Failed to delete conversation'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/ai/conversations/{sessionId}/messages/{messageId}/edit',
      summary: 'Edit a question',
      description:
        'Writes the new text in place of a question, as its sibling, and answers it. The previous branch is kept.',
      operationIdBase: 'editAiConversationMessage',
      parameters: effectParameters(messageParams, 'path'),
      request: { body: effectJsonBody(conversationEditRequestSchema) },
      responses: turnResponses,
    },
    {
      method: 'post',
      pathTemplate: '/api/ai/conversations/{sessionId}/messages/{messageId}/regenerate',
      summary: 'Regenerate an answer',
      description:
        'Asks for another answer to the same question; the new answer is a sibling of the old one, which is kept.',
      operationIdBase: 'regenerateAiConversationMessage',
      parameters: effectParameters(messageParams, 'path'),
      responses: turnResponses,
    },
  ],
}
