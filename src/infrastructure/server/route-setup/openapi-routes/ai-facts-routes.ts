/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import {
  agentFactsChatRequestSchema,
  agentFactsChatResponseSchema,
  agentFactsRecallResponseSchema,
} from '@/domain/models/api/ai/agents'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'


const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)
const agentNameParam = z.object({ name: z.string().describe('Agent name') })

export const aiFactsGroup: StaticGroupSpec = {
  tag: 'ai',
  tagDescription: 'AI assistant, conversations, and retrieval-augmented generation',
  routes: [
    {
      method: 'post',
      pathTemplate: '/api/ai/agents/{name}/chat',
      summary: 'Chat with a memory-enabled agent',
      description:
        'Sends a chat turn to the agent; the reply is persisted as a fact when the agent has memory enabled.',
      operationIdBase: 'agentFactsChat',
      request: {
        params: agentNameParam,
        body: { content: { 'application/json': { schema: agentFactsChatRequestSchema } } },
      },
      responses: {
        200: jsonResponse(agentFactsChatResponseSchema, 'Agent reply'),
        400: errorResponse('Missing agent name or empty message'),
        404: errorResponse('Agent not declared in the app schema'),
        502: errorResponse('AI provider temporarily unavailable'),
        503: errorResponse('AI provider not configured'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/ai/agents/{name}/recall',
      summary: 'Recall agent facts',
      description: 'Returns the facts stored for the calling user in the agent memory namespace.',
      operationIdBase: 'agentFactsRecall',
      request: { params: agentNameParam },
      responses: {
        200: jsonResponse(agentFactsRecallResponseSchema, 'Recalled facts'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('Agent not declared in the app schema'),
        500: errorResponse('Failed to recall facts'),
      },
    },
  ],
}
