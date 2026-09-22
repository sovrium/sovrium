/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  agentFactsChatRequestSchema,
  agentFactsChatResponseSchema,
  agentFactsRecallResponseSchema,
} from '@/domain/models/api/ai/agents'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  effectJsonBody,
  effectJsonResponse,
  effectParameters,
} from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

/**
 * AI agent facts-memory routes — per-agent chat with fact persistence, and
 * recall of stored facts. The `{name}` segment is the agent name (documented
 * as a literal path parameter).
 */

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)
const agentNameParam = Schema.Struct({
  name: Schema.String.annotate({ description: 'Agent name' }),
})

/** AI agent facts-memory route group. */
export const aiFactsGroup: StaticGroupSpec = {
  tag: 'AI',
  tagDescription: 'AI assistant, conversations, and retrieval-augmented generation',
  routes: [
    {
      method: 'post',
      pathTemplate: '/api/ai/agents/{name}/chat',
      summary: 'Chat with a memory-enabled agent',
      description:
        'Sends a chat turn to the agent; the reply is persisted as a fact when the agent has memory enabled.',
      operationIdBase: 'agentFactsChat',

      parameters: effectParameters(agentNameParam, 'path'),
      request: { body: effectJsonBody(agentFactsChatRequestSchema) },
      responses: {
        200: effectJsonResponse(agentFactsChatResponseSchema, 'Agent reply'),
        400: errorResponse('Missing agent name or empty message'),
        404: errorResponse(
          'Agent not declared in the app schema, or the caller lacks permission to invoke it'
        ),
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

      parameters: effectParameters(agentNameParam, 'path'),
      responses: {
        200: effectJsonResponse(agentFactsRecallResponseSchema, 'Recalled facts'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('Agent not declared in the app schema'),
        500: errorResponse('Failed to recall facts'),
      },
    },
  ],
}
