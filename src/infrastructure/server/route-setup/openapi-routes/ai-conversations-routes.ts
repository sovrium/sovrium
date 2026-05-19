/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import {
  conversationDetailResponseSchema,
  conversationListResponseSchema,
} from '@/domain/models/api/ai/conversations'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'

const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)
const sessionIdParam = z.object({
  sessionId: z.string().describe('Conversation session identifier'),
})

export const aiConversationGroup: StaticGroupSpec = {
  tag: 'ai',
  tagDescription: 'AI assistant, conversations, and retrieval-augmented generation',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/ai/conversations',
      summary: 'List AI conversations',
      description: 'Returns the conversation threads belonging to the authenticated user.',
      operationIdBase: 'listAiConversations',
      responses: {
        200: jsonResponse(conversationListResponseSchema, 'Conversation list'),
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
      request: { params: sessionIdParam },
      responses: {
        200: jsonResponse(conversationDetailResponseSchema, 'Conversation detail'),
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
      request: { params: sessionIdParam },
      responses: {
        200: jsonResponse(
          z.object({
            deleted: z.boolean().describe('Whether the conversation was deleted'),
            sessionId: z.string().describe('Conversation session identifier'),
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
