/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// Chat request schema
// ---------------------------------------------------------------------------

/**
 * Chat request schema for the AI chat endpoint.
 *
 * Used for:
 * - OpenAPI documentation generation
 * - Runtime API request validation via `effectValidator`
 * - Hono RPC client type inference
 */
export const chatRequestSchema = Schema.Struct({
  message: Schema.String.annotate({ description: 'User message to send to the AI' }).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
  sessionId: optionalField(
    Schema.String.annotate({
      description: 'Session identifier for conversation continuity (auto-generated if omitted)',
    })
  ),
  context: optionalField(
    Schema.Struct({
      table: optionalField(
        Schema.String.annotate({ description: 'Current table context for scoped queries' })
      ),
      recordId: optionalField(
        Schema.Union([Schema.String, Schema.Finite]).annotate({
          description: 'Current record context for targeted operations',
        })
      ),
    }).annotate({ description: 'Optional context about the current page or view' })
  ),
  confirmationToken: optionalField(
    Schema.String.annotate({
      description: 'Token to confirm a previously pending destructive action',
    })
  ),
  agent: optionalField(
    Schema.String.annotate({
      description: 'Name of a declared app.agents[] entry to bind this chat turn to',
    })
  ),
})

// ---------------------------------------------------------------------------
// Chat action schema
// ---------------------------------------------------------------------------

/**
 * Describes an action taken by the AI during chat processing.
 */
export const chatActionSchema = Schema.Struct({
  type: Schema.Literals(['query', 'create', 'update', 'delete', 'automation']).annotate({
    description: 'Type of action performed',
  }),
  table: optionalField(Schema.String.annotate({ description: 'Table affected by the action' })),
  recordId: optionalField(
    Schema.Union([Schema.String, Schema.Finite]).annotate({
      description: 'Record affected by the action',
    })
  ),
  description: Schema.String.annotate({
    description: 'Human-readable description of the action taken',
  }),
  /**
   * Automation name — present only on `type: 'automation'` actions produced
   * when a chat turn triggers a manual automation.
   */
  name: optionalField(
    Schema.String.annotate({ description: 'Automation name (automation actions only)' })
  ),
  /**
   * Automation run status — `'completed' | 'failed' | 'running'`. Present only
   * on `type: 'automation'` actions.
   */
  status: optionalField(
    Schema.Literals(['completed', 'failed', 'running']).annotate({
      description: 'Automation run status (automation actions only)',
    })
  ),
  /**
   * Automation run identifier — correlates with `GET /api/automations/runs/:id`.
   * Present only on `type: 'automation'` actions.
   */
  runId: optionalField(
    Schema.String.annotate({ description: 'Automation run id (automation actions only)' })
  ),
  /**
   * Automation run duration in seconds. Present only on `type: 'automation'`
   * actions when the duration is known.
   */
  duration: optionalField(
    Schema.Finite.annotate({ description: 'Automation run duration in seconds' })
  ),
})

// ---------------------------------------------------------------------------
// Pending confirmation schema
// ---------------------------------------------------------------------------

/**
 * Describes a destructive action awaiting user confirmation.
 */
export const pendingConfirmationSchema = Schema.Struct({
  action: Schema.String.annotate({
    description: 'Action type requiring confirmation (e.g. delete, bulk update)',
  }),
  table: Schema.String.annotate({ description: 'Table affected by the pending action' }),
  affectedCount: Schema.Int.annotate({
    description: 'Number of records that will be affected',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))),
  description: Schema.String.annotate({
    description: 'Human-readable description of the pending action',
  }),
  confirmationToken: Schema.String.annotate({
    description: 'Token to include in next request to confirm the action',
  }),
})

// ---------------------------------------------------------------------------
// Chat response schema
// ---------------------------------------------------------------------------

/**
 * Chat response schema for the AI chat endpoint.
 *
 * Used for:
 * - OpenAPI documentation generation
 * - Runtime API response validation
 * - Hono RPC client type inference
 */
export const chatResponseSchema = Schema.Struct({
  reply: Schema.String.annotate({ description: 'AI-generated text response to the user' }),
  actions: Schema.Array(chatActionSchema).annotate({
    description: 'Actions taken by the AI during this turn',
  }),
  sessionId: Schema.String.annotate({
    description: 'Session identifier for conversation continuity',
  }),
  pendingConfirmation: optionalField(
    pendingConfirmationSchema.annotate({
      description: 'Destructive action awaiting user confirmation before execution',
    })
  ),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type ChatRequest = typeof chatRequestSchema.Type
export type ChatAction = typeof chatActionSchema.Type
export type PendingConfirmation = typeof pendingConfirmationSchema.Type
export type ChatResponse = typeof chatResponseSchema.Type
