/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ragRebuildRequestSchema, ragRebuildResponseSchema } from '@/domain/models/api/ai/rag'
import { ragSearchRequestSchema, ragSearchResponseSchema } from '@/domain/models/api/ai/search'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  effectJsonBody,
  effectJsonResponse,
  effectParameters,
} from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)

/** Retrieval-augmented generation (RAG) route group. */
export const ragGroup: StaticGroupSpec = {
  tag: 'AI',
  tagDescription: 'AI assistant, conversations, and retrieval-augmented generation',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/ai/rag/config',
      summary: 'Get RAG configuration',
      description: 'Returns the resolved retrieval-augmented generation configuration.',
      operationIdBase: 'getRagConfig',
      responses: {
        200: effectJsonResponse(Schema.Unknown, 'Resolved RAG configuration'),
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
        200: effectJsonResponse(Schema.Unknown, 'RAG index status'),
        401: errorResponse('Not authenticated'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/ai/rag/search',
      summary: 'Search the knowledge base',
      description: 'Runs a similarity search over indexed knowledge for an optional agent.',
      operationIdBase: 'postRagSearch',

      request: { body: effectJsonBody(ragSearchRequestSchema) },
      responses: {
        200: effectJsonResponse(ragSearchResponseSchema, 'Search results'),
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

      request: { body: effectJsonBody(ragRebuildRequestSchema) },
      responses: {
        200: effectJsonResponse(ragRebuildResponseSchema, 'Rebuild result'),
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

      parameters: effectParameters(
        Schema.Struct({
          name: Schema.String.annotate({ description: 'Agent name' }),
        }),
        'path'
      ),
      responses: {
        200: effectJsonResponse(Schema.Unknown, 'Agent knowledge configuration'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('Agent not found'),
      },
    },
  ],
}
