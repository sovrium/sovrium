/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'


export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired'])

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

export type ApprovalStatus = z.infer<typeof approvalStatusSchema>
export type SerializedAgent = z.infer<typeof serializedAgentSchema>
export type SerializedApproval = z.infer<typeof serializedApprovalSchema>
export type ExecuteResult = z.infer<typeof executeResultSchema>
