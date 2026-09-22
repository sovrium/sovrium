/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  conversationDetailResponseSchema,
  conversationListResponseSchema,
} from '@/domain/models/api/ai/conversations'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { effectJsonResponse, effectParameters } from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)
const sessionIdParam = Schema.Struct({
  sessionId: Schema.String.annotate({ description: 'Conversation session identifier' }),
})

/** AI conversation history route group. */
export const aiConversationGroup: StaticGroupSpec = {
  tag: 'AI',
  tagDescription: 'AI assistant, conversations, and retrieval-augmented generation',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/ai/conversations',
      summary: 'List AI conversations',
      description: 'Returns the conversation threads belonging to the authenticated user.',
      operationIdBase: 'listAiConversations',
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
      description: 'Returns a single conversation thread with its messages.',
      operationIdBase: 'getAiConversation',

      parameters: effectParameters(sessionIdParam, 'path'),
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
  ],
}
