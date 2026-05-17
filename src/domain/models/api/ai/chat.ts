/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Chat request schema
// ---------------------------------------------------------------------------

/**
 * Chat request schema for the AI chat endpoint.
 *
 * Used for:
 * - OpenAPI documentation generation
 * - Runtime API request validation via @hono/zod-validator
 * - Hono RPC client type inference
 */
export const chatRequestSchema = z.object({
  message: z.string().min(1).describe('User message to send to the AI'),
  sessionId: z
    .string()
    .optional()
    .describe('Session identifier for conversation continuity (auto-generated if omitted)'),
  context: z
    .object({
      table: z.string().optional().describe('Current table context for scoped queries'),
      recordId: z
        .union([z.string(), z.number()])
        .optional()
        .describe('Current record context for targeted operations'),
    })
    .optional()
    .describe('Optional context about the current page or view'),
  confirmationToken: z
    .string()
    .optional()
    .describe('Token to confirm a previously pending destructive action'),
})

// ---------------------------------------------------------------------------
// Chat action schema
// ---------------------------------------------------------------------------

/**
 * Describes an action taken by the AI during chat processing.
 */
export const chatActionSchema = z.object({
  type: z
    .enum(['query', 'create', 'update', 'delete', 'automation'])
    .describe('Type of action performed'),
  table: z.string().optional().describe('Table affected by the action'),
  recordId: z.union([z.string(), z.number()]).optional().describe('Record affected by the action'),
  description: z.string().describe('Human-readable description of the action taken'),
})

// ---------------------------------------------------------------------------
// Pending confirmation schema
// ---------------------------------------------------------------------------

/**
 * Describes a destructive action awaiting user confirmation.
 */
export const pendingConfirmationSchema = z.object({
  action: z.string().describe('Action type requiring confirmation (e.g. delete, bulk update)'),
  table: z.string().describe('Table affected by the pending action'),
  affectedCount: z.number().int().min(1).describe('Number of records that will be affected'),
  description: z.string().describe('Human-readable description of the pending action'),
  confirmationToken: z.string().describe('Token to include in next request to confirm the action'),
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
export const chatResponseSchema = z.object({
  reply: z.string().describe('AI-generated text response to the user'),
  actions: z.array(chatActionSchema).describe('Actions taken by the AI during this turn'),
  sessionId: z.string().describe('Session identifier for conversation continuity'),
  pendingConfirmation: pendingConfirmationSchema
    .optional()
    .describe('Destructive action awaiting user confirmation before execution'),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type ChatRequest = z.infer<typeof chatRequestSchema>
export type ChatAction = z.infer<typeof chatActionSchema>
export type PendingConfirmation = z.infer<typeof pendingConfirmationSchema>
export type ChatResponse = z.infer<typeof chatResponseSchema>
