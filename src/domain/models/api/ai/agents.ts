/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

/**
 * AI agent facts-memory API contract schemas.
 *
 * Mirrors the runtime shapes in
 * `src/presentation/api/routes/ai/facts-memory-route.ts`. Backs the OpenAPI
 * documentation for the `/api/ai/agents/:name/*` route group (memory-enabled
 * agent chat and per-user fact recall).
 */

/** Request body for a memory-enabled agent chat turn. */
export const agentFactsChatRequestSchema = z.object({
  message: z.string(),
  sessionId: z.string().optional(),
})

/** Response of a memory-enabled agent chat turn. */
export const agentFactsChatResponseSchema = z.object({
  reply: z.string(),
  actions: z.array(z.unknown()),
  sessionId: z.string(),
})

/** A single stored agent fact. */
export const agentFactSchema = z.object({
  fact: z.string(),
  createdAt: z.string().describe('ISO 8601 timestamp'),
})

/** Response of an agent facts recall. */
export const agentFactsRecallResponseSchema = z.object({ facts: z.array(agentFactSchema) })

/** @public */
export type AgentFactsChatRequest = z.infer<typeof agentFactsChatRequestSchema>
/** @public */
export type AgentFactsChatResponse = z.infer<typeof agentFactsChatResponseSchema>
/** @public */
export type AgentFact = z.infer<typeof agentFactSchema>
/** @public */
export type AgentFactsRecallResponse = z.infer<typeof agentFactsRecallResponseSchema>
