/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cron, DateTime, Either, Schema } from 'effect'

export const AgentScheduleSchema = Schema.Struct({
  cron: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Standard 5-field cron expression',
      examples: ['*/15 * * * *', '0 9 * * MON', '0 2 * * *'],
    })
  ),

  timezone: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description: 'IANA timezone identifier (defaults to UTC)',
        examples: ['UTC', 'Europe/Paris', 'America/New_York'],
      })
    )
  ),

  taskPrompt: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Prompt sent to the LLM as the user message for each scheduled execution',
    })
  ),
}).pipe(
  Schema.filter(({ cron, timezone }) => {
    const tz = timezone ?? 'UTC'
    const zone = Either.try({
      try: () => DateTime.zoneUnsafeMakeNamed(tz),
      catch: () => undefined,
    })
    if (Either.isLeft(zone)) return `Invalid IANA timezone: ${tz}`
    const parsed = Cron.parse(cron, zone.right)
    if (Either.isLeft(parsed)) {
      const cause = parsed.left as unknown as { readonly message?: string }
      const detail = cause.message ?? String(parsed.left)
      return `Invalid cron expression "${cron}": ${detail}`
    }
    return undefined
  }),
  Schema.annotations({
    identifier: 'AgentSchedule',
    title: 'Agent Schedule',
    description:
      'Periodic execution configuration using cron expressions. The taskPrompt is sent to the LLM on each run.',
  })
)

export type AgentSchedule = Schema.Schema.Type<typeof AgentScheduleSchema>
