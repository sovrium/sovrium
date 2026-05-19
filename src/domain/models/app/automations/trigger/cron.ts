/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cron, DateTime, Either, Schema } from 'effect'

export const CronTriggerSchema = Schema.Struct({
  type: Schema.Literal('cron'),
  expression: Schema.String.pipe(
    Schema.annotations({
      description:
        'Cron expression (e.g., "0 9 * * 1-5"). Standard 5-field or 6-field with seconds. ' +
        'No @daily/@hourly/@weekly aliases — use the equivalent numeric expression instead.',
    })
  ),
  timezone: Schema.optionalWith(
    Schema.String.pipe(
      Schema.annotations({ description: 'IANA timezone (e.g., "America/New_York"). Default: UTC' })
    ),
    { default: () => 'UTC' }
  ),
}).pipe(
  Schema.filter(({ expression, timezone }) => {
    const zone = Either.try({
      try: () => DateTime.zoneUnsafeMakeNamed(timezone),
      catch: () => undefined,
    })
    if (Either.isLeft(zone)) return `Invalid IANA timezone: ${timezone}`
    const parsed = Cron.parse(expression, zone.right)
    if (Either.isLeft(parsed)) {
      const cause = parsed.left as unknown as { readonly message?: string }
      const detail = cause.message ?? String(parsed.left)
      return `Invalid cron expression "${expression}": ${detail}`
    }
    return undefined
  }),
  Schema.annotations({
    identifier: 'CronTrigger',
    title: 'Cron Trigger',
    description: 'Trigger automation on a schedule using cron expressions',
  })
)

export type CronTrigger = Schema.Schema.Type<typeof CronTriggerSchema>
