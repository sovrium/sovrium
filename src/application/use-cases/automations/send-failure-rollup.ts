/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The hourly failure roll-up.
 *
 * An automation that fails every minute must not send sixty emails an hour. Its
 * first final failure is emailed at once (`notify-platform-failure.ts`); every
 * further final failure of it within the next hour is HELD BACK, and this job
 * collects the held-back failures of the past hour into ONE email that names
 * each automation, how many more times it failed, its last error, and when it
 * recovered if a run has succeeded since.
 *
 * Which failures were held back is recomputed from the run history rather than
 * recorded at send time: a failure was held back exactly when another final
 * failure of the same automation completed in the hour before it. So the job
 * reads two hours — the hour it reports, and the hour before it that decides
 * the first failures of the reported one.
 *
 * Runs at the top of every hour in the operator's timezone
 * (`register-failure-rollup.ts`), and on demand through the token-gated
 * `POST /api/internal/notifications/automation-rollup`. A roll-up lost to a
 * restart is not caught up: the immediate alert already went out, and the next
 * failure starts a new one.
 */

import { Effect } from 'effect'
import { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import {
  FAILURE_ALERT_WINDOW_MS,
  groupHeldBackFailures,
  selectHeldBackFailures,
  type RollupGroup,
} from '@/domain/models/app/automations/automation-run-outcome-service'
import { summariseRunError } from '@/domain/models/app/automations/failure-summary-service'
import { deliverAutomationNotice, type AutomationNoticeContent } from './automation-notice'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { AutomationRunOutcomeDatabaseError } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import type { App } from '@/domain/models/app'

/** One automation in the roll-up email. */
interface FailureRollupEntry {
  readonly name: string
  readonly extraFailures: number
  readonly lastError: string
  /** When a run succeeded after the last failure, ISO 8601; `null` if none has. */
  readonly recoveredAt: string | null
}

/**
 * What one roll-up did. `sent` is false when there was nothing to report or
 * nobody to tell. The last error stays in the email: this summary is what the
 * trigger route answers, and an error message is data an upstream may have
 * echoed.
 */
export interface FailureRollupResult {
  readonly sent: boolean
  readonly automations: ReadonlyArray<{
    readonly name: string
    readonly extraFailures: number
    readonly recoveredAt: string | null
  }>
}

/** Look up whether, and when, each automation recovered after its last failure. */
const withRecovery = (
  groups: readonly RollupGroup[]
): Effect.Effect<
  readonly FailureRollupEntry[],
  AutomationRunOutcomeDatabaseError,
  AutomationRunOutcomeRepository
> =>
  Effect.gen(function* () {
    const repository = yield* AutomationRunOutcomeRepository
    return yield* Effect.forEach(groups, (group) =>
      repository
        .findFirstCompletedAfter({ automationName: group.name, after: group.lastFailedAt })
        .pipe(
          Effect.map((recovered): FailureRollupEntry => ({
            name: group.name,
            extraFailures: group.extraFailures,
            lastError: group.lastError,
            // eslint-disable-next-line unicorn/no-null -- the route's contract is `null` for "not recovered"
            recoveredAt: recovered === undefined ? null : recovered.toISOString(),
          }))
        )
    )
  })

/** The lines one automation contributes to the roll-up. */
const entryLines = (entry: FailureRollupEntry): readonly string[] => [
  `Automation: ${entry.name}`,
  `Further failures: ${entry.extraFailures}`,
  `Last error: ${summariseRunError(entry.lastError)}`,
  entry.recoveredAt === null
    ? 'Still failing: no run has succeeded since.'
    : `Recovered at: ${entry.recoveredAt} (a later run succeeded).`,
]

/** What the roll-up says. */
const rollupNotice = (entries: readonly FailureRollupEntry[]): AutomationNoticeContent => {
  const failures = entries.reduce((sum, entry) => sum + entry.extraFailures, 0)
  return {
    title: `Automation failures in the last hour: ${entries.map((entry) => entry.name).join(', ')}`,
    intro: `After their first failure was emailed, ${entries.length === 1 ? 'this automation' : 'these automations'} failed ${failures} more ${failures === 1 ? 'time' : 'times'} in the last hour. Those failures were held back and are summarised here.`,
    sections: entries.map((entry) => ({ lines: entryLines(entry) })),
  }
}

/**
 * Collect the held-back failures of the hour ending `now` and email them as one
 * roll-up to the automation-alert recipients.
 */
export const sendFailureRollup = (
  app: App,
  now: Date = new Date()
): Effect.Effect<
  FailureRollupResult,
  AutomationRunOutcomeDatabaseError,
  AutomationRunOutcomeRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const hourStart = new Date(now.getTime() - FAILURE_ALERT_WINDOW_MS)
    const repository = yield* AutomationRunOutcomeRepository
    const failures = yield* repository.listFinalFailures({
      from: new Date(hourStart.getTime() - FAILURE_ALERT_WINDOW_MS),
      to: now,
    })
    const groups = groupHeldBackFailures(selectHeldBackFailures(failures, hourStart, now))
    if (groups.length === 0) return { sent: false, automations: [] }
    const automations = yield* withRecovery(groups)
    const recipients = yield* deliverAutomationNotice({ app, content: rollupNotice(automations) })
    return {
      sent: recipients > 0,
      automations: automations.map(({ name, extraFailures, recoveredAt }) => ({
        name,
        extraFailures,
        recoveredAt,
      })),
    }
  }).pipe(Effect.withSpan('automations.send-failure-rollup'))
