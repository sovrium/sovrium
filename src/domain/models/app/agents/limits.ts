/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * AgentLimitsSchema defines operational limits to prevent runaway agents
 * from exhausting API quotas or overwhelming the system.
 *
 * All fields are optional and fall back to system defaults:
 * - maxActionsPerMinute: 30
 * - maxTokensPerDay: 200,000
 * - maxConcurrentTasks: 5
 *
 * Token usage is tracked per agent per day and resets at midnight UTC.
 */
export const AgentLimitsSchema = Schema.Struct({
  /** Maximum DB/email actions per minute (defaults to 30) */
  maxActionsPerMinute: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum DB/email actions per minute (defaults to 30)',
      })
    )
  ),

  /** Maximum LLM tokens consumed per 24h period (defaults to 200000) */
  maxTokensPerDay: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum LLM tokens consumed per 24h period (defaults to 200000)',
      })
    )
  ),

  /** Maximum simultaneous task executions (defaults to 5) */
  maxConcurrentTasks: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum simultaneous task executions (defaults to 5)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AgentLimits',
    title: 'Agent Operational Limits',
    description:
      'Rate limits, token budgets, and concurrency caps for an agent. All fields default to system values when omitted.',
  })
)

/** @public */
export type AgentLimits = Schema.Schema.Type<typeof AgentLimitsSchema>
