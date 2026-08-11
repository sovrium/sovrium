/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

/**
 * AI agent API contract schemas.
 *
 * These mirror the runtime presenter shapes in
 * `src/presentation/api/routes/agents/`. They back the OpenAPI documentation
 * for the agent route group.
 */

/** Approval lifecycle status. */
export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired'])

/** A serialized AI agent configuration. */
export const serializedAgentSchema = z.object({
  name: z.string(),
  role: z.string(),
  systemPrompt: z.string(),
  enabled: z.boolean(),
  model: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  instructions: z.array(z.string()).optional(),
  approval: z
    .object({
      mode: z.enum(['none', 'all', 'selective']).optional(),
      required: z.array(z.string()).optional(),
      timeout: z.number().optional(),
      escalation: z.object({ after: z.number(), to: z.string() }).optional(),
    })
    .optional(),
  tools: z.object({ tables: z.array(z.string()), actions: z.array(z.string()) }).optional(),
  limits: z.object({
    maxActionsPerMinute: z.number(),
    maxTokensPerDay: z.number(),
    maxConcurrentTasks: z.number(),
  }),
})

/** A serialized agent approval request. */
export const serializedApprovalSchema = z.object({
  approvalId: z.string(),
  id: z.string(),
  agent: z.string(),
  action: z.string(),
  status: approvalStatusSchema,
  timeout: z.number(),
  actionExecuted: z.boolean(),
  executedAs: z.string().optional(),
  escalated: z.boolean(),
  escalatedTo: z.string().optional(),
  createdAt: z.string(),
  expiresAt: z.string(),
})

/** Result of an agent action execution — completed, pending approval, or queued. */
export const executeResultSchema = z.union([
  z.object({
    status: z.literal('completed'),
    approvalRequired: z.literal(false),
    agent: z.string(),
  }),
  z.object({
    status: z.literal('pending_approval'),
    approvalRequired: z.literal(true),
    approvalId: z.string(),
    agent: z.string(),
  }),
  z.object({ status: z.literal('queued'), agent: z.string(), reason: z.string() }),
])

/** @public */
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>
/** @public */
export type SerializedAgent = z.infer<typeof serializedAgentSchema>
/** @public */
export type SerializedApproval = z.infer<typeof serializedApprovalSchema>
/** @public */
export type ExecuteResult = z.infer<typeof executeResultSchema>
