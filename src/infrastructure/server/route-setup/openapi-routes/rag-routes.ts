/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import { ragRebuildRequestSchema, ragRebuildResponseSchema } from '@/domain/models/api/ai/rag'
import { type StaticGroupSpec, jsonResponse } from './_shared/route-spec'

const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

export const ragGroup: StaticGroupSpec = {
  tag: 'ai',
  tagDescription: 'AI assistant, conversations, and retrieval-augmented generation',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/ai/rag/config',
      summary: 'Get RAG configuration',
      description: 'Returns the resolved retrieval-augmented generation configuration.',
      operationIdBase: 'getRagConfig',
      responses: {
        200: jsonResponse(z.unknown(), 'Resolved RAG configuration'),
        401: errorResponse('Not authenticated'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/ai/rag/status',
      summary: 'Get RAG index status',
      description: 'Returns the indexed knowledge documents and their paths.',
      operationIdBase: 'getRagStatus',
      responses: {
        200: jsonResponse(z.unknown(), 'RAG index status'),
        401: errorResponse('Not authenticated'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/ai/rag/search',
      summary: 'Search the knowledge base',
      description: 'Runs a similarity search over indexed knowledge for an optional agent.',
      operationIdBase: 'postRagSearch',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({
                query: z.string().describe('Search query text'),
                agent: z.string().optional().describe('Restrict the search to this agent'),
              }),
            },
          },
        },
      },
      responses: {
        200: jsonResponse(z.unknown(), 'Search results'),
        400: errorResponse('Query missing or blank'),
        401: errorResponse('Not authenticated'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/ai/rag/rebuild',
      summary: 'Rebuild the knowledge index',
      description:
        'Re-indexes knowledge sources for an optional agent. Admin only when auth is configured.',
      operationIdBase: 'postRagRebuild',
      request: {
        body: { content: { 'application/json': { schema: ragRebuildRequestSchema } } },
      },
      responses: {
        200: jsonResponse(ragRebuildResponseSchema, 'Rebuild result'),
        401: errorResponse('Not authenticated'),
        403: errorResponse('Admin role required'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/ai/agents/{name}/config',
      summary: 'Get agent knowledge config',
      description: 'Returns the knowledge tables and documents configured for an agent.',
      operationIdBase: 'getAgentKnowledgeConfig',
      request: {
        params: z.object({ name: z.string().describe('Agent name') }),
      },
      responses: {
        200: jsonResponse(z.unknown(), 'Agent knowledge configuration'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('Agent not found'),
      },
    },
  ],
}
