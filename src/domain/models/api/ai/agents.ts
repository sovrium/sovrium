/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * AI agent facts-memory API contract schemas.
 *
 * Mirrors the runtime shapes in
 * `src/presentation/api/routes/ai/facts-memory-route.ts`. Backs the OpenAPI
 * documentation for the `/api/ai/agents/:name/*` route group (memory-enabled
 * agent chat and per-user fact recall).
 */

/** Request body for a memory-enabled agent chat turn. */
export const agentFactsChatRequestSchema = Schema.Struct({
  message: Schema.String,
  sessionId: optionalField(Schema.String),
})

/** Response of a memory-enabled agent chat turn. */
export const agentFactsChatResponseSchema = Schema.Struct({
  reply: Schema.String,
  actions: Schema.Array(Schema.Unknown),
  sessionId: Schema.String,
})

/** A single stored agent fact. */
export const agentFactSchema = Schema.Struct({
  fact: Schema.String,
  createdAt: Schema.String.annotate({ description: 'ISO 8601 timestamp' }),
})

/** Response of an agent facts recall. */
export const agentFactsRecallResponseSchema = Schema.Struct({
  facts: Schema.Array(agentFactSchema),
})

/** @public */
export type AgentFactsChatRequest = typeof agentFactsChatRequestSchema.Type
/** @public */
export type AgentFactsChatResponse = typeof agentFactsChatResponseSchema.Type
/** @public */
export type AgentFact = typeof agentFactSchema.Type
/** @public */
export type AgentFactsRecallResponse = typeof agentFactsRecallResponseSchema.Type
