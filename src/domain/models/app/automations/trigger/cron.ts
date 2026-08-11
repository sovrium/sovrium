/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cron, DateTime, Either, Schema } from 'effect'

/**
 * Cron Trigger
 *
 * Scheduled execution using cron expressions.
 *
 * Validation is delegated to Effect's `Cron.parse`
 * (https://effect.website/docs/scheduling/cron/) instead of a hand-rolled
 * regex, so:
 *   - Field ranges are enforced (minute 0-59, hour 0-23, day 1-31, month
 *     1-12, weekday 0-6).
 *   - `*\/0` style zero-step expressions are rejected.
 *   - Cron aliases (`@daily`, `@hourly`, `@weekly`) are NOT supported —
 *     Effect's parser is strictly numeric/range/list-based.
 *   - Both standard 5-field and 6-field (with seconds) expressions are
 *     accepted.
 *
 * Timezone is validated as an IANA identifier via
 * `DateTime.zoneUnsafeMakeNamed`. Invalid zones cause schema validation to
 * fail at server boot.
 */
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
    // `DateTime.zoneUnsafeMakeNamed` throws for invalid IANA identifiers —
    // wrap in `Either.try` so the filter stays expression-only (functional/no-let).
    //
    // The `Cron.parse + zoneUnsafeMakeNamed` triplet also appears in
    // `cron-scheduler-live.ts:scheduleImpl` (returns `CronSchedulerError`) and
    // `presentation/api/routes/automations/index.ts:computeCronNextRunOverlay`
    // (returns `undefined` on failure). They are kept inline rather than
    // extracted because the error contracts differ: this site needs a string
    // message (Schema.filter contract), the scheduler needs a tagged error
    // chain that preserves the original throw, and the overlay swallows
    // failures silently. A shared helper would force adapter wrappers at each
    // site that cost more lines than the duplicated 5 lines save.
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

/** @public */
export type CronTrigger = Schema.Schema.Type<typeof CronTriggerSchema>
