/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import {
  approvalStatusSchema,
  executeResultSchema,
  serializedAgentSchema,
  serializedApprovalSchema,
} from '@/domain/models/api/agents/agents'
import {
  type ResourceGroupSpec,
  type RouteSpec,
  type StaticGroupSpec,
  jsonResponse,
} from './_shared/route-spec'


const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

const routes: readonly RouteSpec[] = [
  {
    method: 'get',
    pathTemplate: '/api/agents/{agentSlug}',
    summary: 'Get an agent',
    description: 'Returns the resolved configuration of a single agent.',
    operationIdBase: 'getAgent',
    responses: {
      200: jsonResponse(serializedAgentSchema, 'Agent configuration'),
      404: errorResponse('Agent not found'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/agents/{agentSlug}/execute',
    summary: 'Execute an agent action',
    description: 'Runs an agent action or conversational turn; may require approval or be queued.',
    operationIdBase: 'executeAgentAction',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              action: z.string().optional(),
              message: z.string().optional(),
              table: z.string().optional(),
              recordId: z.unknown().optional(),
              fields: z.unknown().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: jsonResponse(executeResultSchema, 'Action completed'),
      202: jsonResponse(executeResultSchema, 'Action pending approval or queued'),
      400: errorResponse('Neither action nor message provided'),
      403: errorResponse('Agent disabled'),
      404: errorResponse('Agent not found or access denied'),
      429: errorResponse('Rate limit or daily token budget exceeded'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/agents/{agentSlug}/usage',
    summary: 'Get agent token usage',
    description: 'Returns the agent token usage for the current UTC day.',
    operationIdBase: 'getAgentUsage',
    responses: {
      200: jsonResponse(
        z.object({
          tokensUsedToday: z.number(),
          maxTokensPerDay: z.number(),
          day: z.string().describe('UTC date (YYYY-MM-DD)'),
        }),
        'Agent usage'
      ),
      404: errorResponse('Agent not found'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/agents/{agentSlug}/approvals',
    summary: 'List agent approvals',
    description: 'Lists approval requests for the agent, optionally filtered by status.',
    operationIdBase: 'listAgentApprovals',
    request: {
      query: z.object({
        status: approvalStatusSchema.optional().describe('Filter by approval status'),
      }),
    },
    responses: {
      200: jsonResponse(
        z.object({ approvals: z.array(serializedApprovalSchema) }),
        'Approval list'
      ),
      404: errorResponse('Agent not found'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/agents/{agentSlug}/approvals/{id}',
    summary: 'Get an agent approval',
    description: 'Returns a single approval request.',
    operationIdBase: 'getAgentApproval',
    request: { params: z.object({ id: z.string().describe('Approval identifier') }) },
    responses: {
      200: jsonResponse(serializedApprovalSchema, 'Approval detail'),
      404: errorResponse('Agent or approval not found'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/agents/{agentSlug}/approvals/{id}/approve',
    summary: 'Approve an agent approval',
    description: 'Approves a pending approval request and executes the deferred action.',
    operationIdBase: 'approveAgentApproval',
    request: { params: z.object({ id: z.string().describe('Approval identifier') }) },
    responses: {
      200: jsonResponse(serializedApprovalSchema, 'Approval approved'),
      401: errorResponse('Not authenticated'),
      403: errorResponse('Approver role insufficient'),
      404: errorResponse('Agent or approval not found'),
      409: jsonResponse(
        z.object({ error: z.string(), status: approvalStatusSchema }),
        'Approval already decided'
      ),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/agents/{agentSlug}/approvals/{id}/reject',
    summary: 'Reject an agent approval',
    description: 'Rejects a pending approval request.',
    operationIdBase: 'rejectAgentApproval',
    request: { params: z.object({ id: z.string().describe('Approval identifier') }) },
    responses: {
      200: jsonResponse(serializedApprovalSchema, 'Approval rejected'),
      401: errorResponse('Not authenticated'),
      403: errorResponse('Approver role insufficient'),
      404: errorResponse('Agent or approval not found'),
      409: jsonResponse(
        z.object({ error: z.string(), status: approvalStatusSchema }),
        'Approval already decided'
      ),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/agents/{agentSlug}/schedule',
    summary: 'Get agent schedule',
    description: 'Returns the cron schedule configured for the agent.',
    operationIdBase: 'getAgentSchedule',
    responses: {
      200: jsonResponse(
        z.object({
          agent: z.string(),
          cron: z.string(),
          timezone: z.string(),
          taskPrompt: z.string(),
          nextRunAt: z.string().optional(),
        }),
        'Agent schedule'
      ),
      404: errorResponse('Agent not found or no schedule configured'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/agents/{agentSlug}/schedule/trigger',
    summary: 'Trigger the agent schedule',
    description: 'Runs the agent scheduled task once, immediately.',
    operationIdBase: 'triggerAgentSchedule',
    responses: {
      200: jsonResponse(executeResultSchema, 'Scheduled task completed'),
      202: jsonResponse(executeResultSchema, 'Scheduled task pending approval'),
      403: errorResponse('Agent disabled'),
      404: errorResponse('Agent not found or no schedule configured'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/agents/{agentSlug}/chat',
    summary: 'Chat with an agent',
    description: 'Sends a chat turn to the agent, forwarding its MCP tool catalog to the LLM.',
    operationIdBase: 'chatWithAgent',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              sessionId: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: jsonResponse(
        z.object({ reply: z.string(), sessionId: z.string().optional() }),
        'Agent reply'
      ),
      400: errorResponse('Missing agent name or empty message'),
      404: errorResponse('Agent not found'),
      503: errorResponse('AI provider not configured'),
    },
  },
]

export const agentGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Agent',
  genericTag: 'agents',
  genericTagDescription: 'AI agent execution, approval, and schedule endpoints',
  collection: (app) => app.agents ?? [],
  resourcePlaceholder: '{agentSlug}',
  genericPlaceholder: '{name}',
  genericParamName: 'name',
  routes,
}

export const agentCollectionGroup: StaticGroupSpec = {
  tag: 'agents',
  tagDescription: 'AI agent execution, approval, and schedule endpoints',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/agents',
      summary: 'List agents',
      description: 'Returns all configured agents.',
      operationIdBase: 'listAgents',
      responses: {
        200: jsonResponse(z.array(serializedAgentSchema), 'Agent list'),
      },
    },
  ],
}
