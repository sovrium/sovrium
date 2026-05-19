/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'


export const agentFactsChatRequestSchema = z.object({
  message: z.string(),
  sessionId: z.string().optional(),
})

export const agentFactsChatResponseSchema = z.object({
  reply: z.string(),
  actions: z.array(z.unknown()),
  sessionId: z.string(),
})

export const agentFactSchema = z.object({
  fact: z.string(),
  createdAt: z.string().describe('ISO 8601 timestamp'),
})

export const agentFactsRecallResponseSchema = z.object({ facts: z.array(agentFactSchema) })

export type AgentFactsChatRequest = z.infer<typeof agentFactsChatRequestSchema>
export type AgentFactsChatResponse = z.infer<typeof agentFactsChatResponseSchema>
export type AgentFact = z.infer<typeof agentFactSchema>
export type AgentFactsRecallResponse = z.infer<typeof agentFactsRecallResponseSchema>
