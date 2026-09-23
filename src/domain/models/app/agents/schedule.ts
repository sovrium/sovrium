/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cron, DateTime, Result, Schema } from 'effect'

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
    Schema.annotate({
      description: 'Standard 5-field cron expression',
      examples: ['*/15 * * * *', '0 9 * * MON', '0 2 * * *'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),

  /** IANA timezone identifier (defaults to UTC) */
  timezone: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        howTo:
          'Set it whenever the schedule means something to a person. `0 9 * * MON` in UTC fires at 10 a.m. in Paris for half the year and 11 a.m. for the other half; a named zone follows daylight saving, an offset baked into the expression does not.',
        defaultNote: 'UTC',
        description: 'IANA timezone identifier (defaults to UTC)',
        examples: ['UTC', 'Europe/Paris', 'America/New_York'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /** Prompt describing the task to execute on each scheduled run */
  taskPrompt: Schema.String.pipe(
    Schema.annotate({
      description: 'Prompt sent to the LLM as the user message for each scheduled execution',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
})
  .annotate({
    // Before the checks: a description piped after a `makeFilter` never reaches
    // the published JSON Schema. `identifier` has to stay after them.
    description:
      'Runs the agent on a recurring schedule, written as a cron expression in a named time zone.',
  })
  .pipe(
    Schema.check(
      Schema.makeFilter(({ cron, timezone }) => {
        // Validation is delegated to Effect's `Cron.parse` (the same triplet used
        // by `automations/trigger/cron.ts`): field ranges are enforced, `*\/0`
        // step expressions are rejected, and IANA timezones are validated via
        // `DateTime.zoneMakeNamedUnsafe`. Wrapped in `Either.try` so the filter
        // body stays expression-only (functional/no-let).
        const tz = timezone ?? 'UTC'
        const zone = Result.try({
          try: () => DateTime.zoneMakeNamedUnsafe(tz),
          catch: () => undefined,
        })
        if (Result.isFailure(zone)) return `Invalid IANA timezone: ${tz}`
        const parsed = Cron.parse(cron, zone.success)
        if (Result.isFailure(parsed)) {
          const cause = parsed.failure as unknown as { readonly message?: string }
          const detail = cause.message ?? String(parsed.failure)
          return `Invalid cron expression "${cron}": ${detail}`
        }
        return undefined
      })
    ),
    Schema.annotate({
      identifier: 'AgentSchedule',
      title: 'Agent Schedule',
      description:
        'Periodic execution configuration using cron expressions. The taskPrompt is sent to the LLM on each run.',
    })
  )

/** @public */
export type AgentSchedule = Schema.Schema.Type<typeof AgentScheduleSchema>
