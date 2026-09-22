/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * AI agent API contract schemas.
 *
 * These mirror the runtime presenter shapes in
 * `src/presentation/api/routes/agents/`. They back the OpenAPI documentation
 * for the agent route group.
 */

/** Approval lifecycle status. */
export const approvalStatusSchema = Schema.Literals(['pending', 'approved', 'rejected', 'expired'])

/** A serialized AI agent configuration. */
export const serializedAgentSchema = Schema.Struct({
  name: Schema.String,
  role: Schema.String,
  systemPrompt: Schema.String,
  enabled: Schema.Boolean,
  model: optionalField(Schema.String),
  temperature: optionalField(Schema.Finite),
  maxTokens: optionalField(Schema.Finite),
  instructions: optionalField(Schema.Array(Schema.String)),
  approval: optionalField(
    Schema.Struct({
      mode: optionalField(Schema.Literals(['none', 'all', 'selective'])),
      required: optionalField(Schema.Array(Schema.String)),
      timeout: optionalField(Schema.Finite),
      escalation: optionalField(
        Schema.Struct({
          after: Schema.Finite,
          to: Schema.String,
        })
      ),
    })
  ),
  tools: optionalField(
    Schema.Struct({
      tables: Schema.Array(Schema.String),
      actions: Schema.Array(Schema.String),
    })
  ),
  limits: Schema.Struct({
    maxActionsPerMinute: Schema.Finite,
    maxTokensPerDay: Schema.Finite,
    maxConcurrentTasks: Schema.Finite,
  }),
})

/** A serialized agent approval request. */
export const serializedApprovalSchema = Schema.Struct({
  approvalId: Schema.String,
  id: Schema.String,
  agent: Schema.String,
  action: Schema.String,
  status: approvalStatusSchema,
  timeout: Schema.Finite,
  actionExecuted: Schema.Boolean,
  executedAs: optionalField(Schema.String),
  escalated: Schema.Boolean,
  escalatedTo: optionalField(Schema.String),
  createdAt: Schema.String,
  expiresAt: Schema.String,
})

/** Result of an agent action execution — completed, pending approval, or queued. */
export const executeResultSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal('completed'),
    approvalRequired: Schema.Literal(false),
    agent: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal('pending_approval'),
    approvalRequired: Schema.Literal(true),
    approvalId: Schema.String,
    agent: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal('queued'),
    agent: Schema.String,
    reason: Schema.String,
  }),
])

/** @public */
export type ApprovalStatus = typeof approvalStatusSchema.Type
/** @public */
export type SerializedAgent = typeof serializedAgentSchema.Type
/** @public */
export type SerializedApproval = typeof serializedApprovalSchema.Type
/** @public */
export type ExecuteResult = typeof executeResultSchema.Type
