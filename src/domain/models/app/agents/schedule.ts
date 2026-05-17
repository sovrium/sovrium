/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * AgentScheduleSchema defines periodic execution configuration for an agent.
 *
 * Agents with a schedule run automatically at the specified cron interval.
 * The `taskPrompt` is sent to the LLM as the user message for each execution.
 *
 * Disabled agents (`enabled: false`) skip scheduled executions.
 * Scheduled execution respects approval config (e.g., `mode: all` pauses for approval).
 */
export const AgentScheduleSchema = Schema.Struct({
  /** Standard 5-field cron expression (e.g., every 15 minutes, daily at 2am) */
  cron: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Standard 5-field cron expression',
      examples: ['*/15 * * * *', '0 9 * * MON', '0 2 * * *'],
    })
  ),

  /** IANA timezone identifier (defaults to UTC) */
  timezone: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description: 'IANA timezone identifier (defaults to UTC)',
        examples: ['UTC', 'Europe/Paris', 'America/New_York'],
      })
    )
  ),

  /** Prompt describing the task to execute on each scheduled run */
  taskPrompt: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Prompt sent to the LLM as the user message for each scheduled execution',
    })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AgentSchedule',
    title: 'Agent Schedule',
    description:
      'Periodic execution configuration using cron expressions. The taskPrompt is sent to the LLM on each run.',
  })
)

/** @public */
export type AgentSchedule = Schema.Schema.Type<typeof AgentScheduleSchema>
