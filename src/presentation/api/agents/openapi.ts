/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  approvalStatusSchema,
  executeResultSchema,
  serializedAgentSchema,
  serializedApprovalSchema,
} from '@/domain/models/api/agents/agents'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  effectJsonResponse,
  effectParameters,
  effectSchema,
} from '@/presentation/api/openapi/route-fragments'
import { type ResourceGroupSpec, type RouteSpec, type StaticGroupSpec } from '../openapi/route-spec'

/**
 * AI agent routes — split into a per-agent group (resource-scoped to
 * `app.agents`, tagged `Agent: <name>`) and a static collection group.
 */

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)

const routes: readonly RouteSpec[] = [
  {
    method: 'get',
    pathTemplate: '/api/agents/{agentSlug}',
    summary: 'Get an agent',
    description: 'Returns the resolved configuration of a single agent.',
    operationIdBase: 'getAgent',
    responses: {
      200: effectJsonResponse(serializedAgentSchema, 'Agent configuration'),
      404: errorResponse('Agent not found, or the caller lacks permission to read it back'),
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
            schema: effectSchema(
              Schema.Struct({
                action: Schema.optionalKey(Schema.String),
                message: Schema.optionalKey(Schema.String),
                table: Schema.optionalKey(Schema.String),
                recordId: Schema.optionalKey(Schema.Unknown),
                fields: Schema.optionalKey(Schema.Unknown),
              })
            ),
          },
        },
      },
    },
    responses: {
      200: effectJsonResponse(executeResultSchema, 'Action completed'),
      202: effectJsonResponse(executeResultSchema, 'Action pending approval or queued'),
      400: errorResponse('Neither action nor message provided'),
      403: errorResponse('Agent disabled'),
      404: errorResponse('Agent not found, or the caller lacks permission to invoke it'),
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
      200: effectJsonResponse(
        Schema.Struct({
          tokensUsedToday: Schema.Finite,
          maxTokensPerDay: Schema.Finite,
          day: Schema.String.annotate({ description: 'UTC date (YYYY-MM-DD)' }),
        }),
        'Agent usage'
      ),
      404: errorResponse('Agent not found, or the caller lacks permission to read it back'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/agents/{agentSlug}/approvals',
    summary: 'List agent approvals',
    description: 'Lists approval requests for the agent, optionally filtered by status.',
    operationIdBase: 'listAgentApprovals',
    parameters: effectParameters(
      Schema.Struct({
        status: Schema.optionalKey(
          approvalStatusSchema.annotate({ description: 'Filter by approval status' })
        ),
      }),
      'query'
    ),
    responses: {
      200: effectJsonResponse(
        Schema.Struct({ approvals: Schema.Array(serializedApprovalSchema) }),
        'Approval list'
      ),
      404: errorResponse('Agent not found, or the caller lacks permission to read it back'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/agents/{agentSlug}/approvals/{id}',
    summary: 'Get an agent approval',
    description: 'Returns a single approval request.',
    operationIdBase: 'getAgentApproval',
    parameters: effectParameters(
      Schema.Struct({ id: Schema.String.annotate({ description: 'Approval identifier' }) }),
      'path'
    ),
    responses: {
      200: effectJsonResponse(serializedApprovalSchema, 'Approval detail'),
      404: errorResponse(
        'Agent or approval not found, or the caller lacks permission to read it back'
      ),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/agents/{agentSlug}/approvals/{id}/approve',
    summary: 'Approve an agent approval',
    description: 'Approves a pending approval request and executes the deferred action.',
    operationIdBase: 'approveAgentApproval',
    parameters: effectParameters(
      Schema.Struct({ id: Schema.String.annotate({ description: 'Approval identifier' }) }),
      'path'
    ),
    responses: {
      200: effectJsonResponse(serializedApprovalSchema, 'Approval approved'),
      401: errorResponse('Not authenticated'),
      403: errorResponse('Approver role insufficient'),
      404: errorResponse('Agent or approval not found'),
      409: effectJsonResponse(
        Schema.Struct({ error: Schema.String, status: approvalStatusSchema }),
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
    parameters: effectParameters(
      Schema.Struct({ id: Schema.String.annotate({ description: 'Approval identifier' }) }),
      'path'
    ),
    responses: {
      200: effectJsonResponse(serializedApprovalSchema, 'Approval rejected'),
      401: errorResponse('Not authenticated'),
      403: errorResponse('Approver role insufficient'),
      404: errorResponse('Agent or approval not found'),
      409: effectJsonResponse(
        Schema.Struct({ error: Schema.String, status: approvalStatusSchema }),
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
      200: effectJsonResponse(
        Schema.Struct({
          agent: Schema.String,
          cron: Schema.String,
          timezone: Schema.String,
          taskPrompt: Schema.String,
          nextRunAt: Schema.optionalKey(Schema.String),
        }),
        'Agent schedule'
      ),
      404: errorResponse(
        'Agent not found, no schedule configured, or the caller lacks permission to read it back'
      ),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/agents/{agentSlug}/schedule/trigger',
    summary: 'Trigger the agent schedule',
    description: 'Runs the agent scheduled task once, immediately.',
    operationIdBase: 'triggerAgentSchedule',
    responses: {
      200: effectJsonResponse(executeResultSchema, 'Scheduled task completed'),
      202: effectJsonResponse(executeResultSchema, 'Scheduled task pending approval'),
      403: errorResponse('Agent disabled'),
      404: errorResponse(
        'Agent not found, no schedule configured, or the caller lacks permission to invoke it'
      ),
      429: errorResponse('Rate limit or daily token budget exceeded'),
      503: errorResponse('AI provider not configured'),
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
            schema: effectSchema(
              Schema.Struct({
                message: Schema.String,
                sessionId: Schema.optionalKey(Schema.String),
              })
            ),
          },
        },
      },
    },
    responses: {
      200: effectJsonResponse(
        Schema.Struct({
          reply: Schema.String,
          sessionId: Schema.optionalKey(Schema.String),
        }),
        'Agent reply'
      ),
      400: errorResponse('Missing agent name or empty message'),
      404: errorResponse('Agent not found, or the caller lacks permission to invoke it'),
      503: errorResponse('AI provider not configured'),
    },
  },
]

/** Per-agent route group — resource-scoped to the configured agents. */
export const agentGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Agent',
  genericTag: 'Agents',
  genericTagDescription: 'AI agent execution, approval, and schedule endpoints',
  collection: (app) => app.agents ?? [],
  resourcePlaceholder: '{agentSlug}',
  genericPlaceholder: '{name}',
  genericParamName: 'name',
  routes,
}

/** Agent collection route group — not scoped to one agent. */
export const agentCollectionGroup: StaticGroupSpec = {
  tag: 'Agents',
  tagDescription: 'AI agent execution, approval, and schedule endpoints',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/agents',
      summary: 'List agents',
      description: 'Returns all configured agents.',
      operationIdBase: 'listAgents',
      responses: {
        200: effectJsonResponse(Schema.Array(serializedAgentSchema), 'Agent list'),
      },
    },
  ],
}
