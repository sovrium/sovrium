/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const AgentLimitsSchema = Schema.Struct({
  maxActionsPerMinute: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum DB/email actions per minute (defaults to 30)',
      })
    )
  ),

  maxTokensPerDay: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum LLM tokens consumed per 24h period (defaults to 200000)',
      })
    )
  ),

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

export type AgentLimits = Schema.Schema.Type<typeof AgentLimitsSchema>
