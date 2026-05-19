/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import { chatRequestSchema, chatResponseSchema } from '@/domain/models/api/ai/chat'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'

const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)
const chatRequestBody = { content: { 'application/json': { schema: chatRequestSchema } } }

export const aiChatGroup: StaticGroupSpec = {
  tag: 'ai',
  tagDescription: 'AI assistant, conversations, and retrieval-augmented generation',
  routes: [
    {
      method: 'post',
      pathTemplate: '/api/ai/chat',
      summary: 'Send an AI chat message',
      description:
        'Sends a message to the AI assistant and returns the assistant reply and any actions.',
      operationIdBase: 'postAiChat',
      request: { body: chatRequestBody },
      responses: {
        200: jsonResponse(chatResponseSchema, 'Assistant reply'),
        400: errorResponse('Invalid request body or message too long'),
        401: errorResponse('Not authenticated'),
        403: errorResponse('Forbidden record query or mutation'),
        404: errorResponse('AI is not enabled'),
        429: errorResponse('Chat rate limit exceeded'),
        500: errorResponse('AI provider error'),
        503: errorResponse('AI provider unavailable'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/ai/chat/stream',
      summary: 'Stream an AI chat response',
      description:
        'Sends a message to the AI assistant and streams the reply as Server-Sent Events.',
      operationIdBase: 'postAiChatStream',
      request: { body: chatRequestBody },
      responses: {
        200: {
          content: { 'text/event-stream': { schema: z.string() } },
          description: 'Server-Sent Events stream of reply chunks',
        },
        400: errorResponse('Invalid request body'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('AI is not enabled'),
      },
    },
  ],
}
