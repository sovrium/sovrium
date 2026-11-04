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
 * the first failures of the reported one. A failure the history did not record
 * — the database refused the write — was counted by the server's in-memory
 * hold-back instead, and is merged in here (and forgotten there). A failure the
 * server emailed at once is never counted, even when the history, read now,
 * would place it a hair inside the hour after another: a failure is either
 * emailed at once or counted in one summary, never both.
 *
 * Runs once an hour, at a minute of the hour fixed per instance and derived
 * from the app's name (`register-failure-rollup.ts`), and on demand through the token-gated
 * `POST /api/internal/notifications/automation-rollup`. A roll-up lost to a
 * restart is not caught up: the immediate alert already went out, and the next
 * failure starts a new one.
 */

import { Clock, Effect } from 'effect'
import { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import { FailureAlertHoldBack } from '@/application/ports/services/failure-alert-hold-back'
import {
  FAILURE_ALERT_WINDOW_MS,
  firstRecoveryAfter,
  groupHeldBackFailures,
  mergeRollupGroups,
  selectHeldBackFailures,
  type HeldBackTally,
  type RollupGroup,
} from '@/domain/models/app/automations/automation-run-outcome-service'
import { summariseRunError } from '@/domain/models/app/automations/failure-summary-service'
import { deliverAutomationNotice, type AutomationNoticeContent } from './automation-notice'
import { keepNotifiableFailures } from './notifiable-failures'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { AutomationRunOutcomeDatabaseError } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import type { EmailSender } from '@/application/ports/services/email-sender'
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

/**
 * Look up whether, and when, each automation recovered after its last failure:
 * the earliest success after it, of the one the history recorded and the one
 * the server saw run (a trigger keeping no history of a success still recovered).
 */
const withRecovery = (
  groups: readonly RollupGroup[],
  seen: ReadonlyMap<string, Date>
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
          Effect.map((recorded): FailureRollupEntry => {
            const recovered = firstRecoveryAfter(group.lastFailedAt, [
              recorded,
              seen.get(group.name),
            ])
            return {
              name: group.name,
              extraFailures: group.extraFailures,
              lastError: group.lastError,
              recoveredAt: recovered === undefined ? null : recovered.toISOString(),
            }
          })
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

/**
 * The failures of automations the in-memory hold-back had no room to track
 * one by one, told as a single line rather than dropped.
 */
const overflowLines = (overflow: HeldBackTally): readonly string[] => [
  `Other automations: ${overflow.extraFailures} further ${overflow.extraFailures === 1 ? 'failure' : 'failures'}`,
  `Last error: ${summariseRunError(overflow.lastError)}`,
]

/**
 * What the roll-up says. It names the hour it covers, `[from, to)`, ending when
 * it ran: consecutive hourly roll-ups leave no gap and count no failure twice.
 */
const rollupNotice = (
  entries: readonly FailureRollupEntry[],
  overflow: HeldBackTally | undefined,
  span: { readonly from: Readonly<Date>; readonly to: Readonly<Date> }
): AutomationNoticeContent => {
  const failures =
    entries.reduce((sum, entry) => sum + entry.extraFailures, 0) + (overflow?.extraFailures ?? 0)
  const names = [
    ...entries.map((entry) => entry.name),
    ...(overflow === undefined ? [] : ['other automations']),
  ]
  return {
    title: `Automation failures in the last hour: ${names.join(', ')}`,
    intro: `After their first failure was emailed, ${names.length === 1 ? 'this automation' : 'these automations'} failed ${failures} more ${failures === 1 ? 'time' : 'times'} in the last hour. Those failures were held back and are summarised here. This summary covers the hour from ${span.from.toISOString()} to ${span.to.toISOString()}.`,
    sections: [
      ...entries.map((entry) => ({ lines: entryLines(entry) })),
      ...(overflow === undefined ? [] : [{ lines: overflowLines(overflow) }]),
    ],
  }
}

/**
 * Collect the held-back failures of the hour ending `now` and email them as one
 * roll-up to the automation-alert recipients. Without `now`, the hour ends when
 * the Effect RUNS, read from the clock, never when it was built: one Effect run
 * hourly reports a new hour each time.
 */
export const sendFailureRollup = (
  app: App,
  at?: Readonly<Date>
): Effect.Effect<
  FailureRollupResult,
  AutomationRunOutcomeDatabaseError,
  AutomationRunOutcomeRepository | AuthRepository | EmailSender | FailureAlertHoldBack
> =>
  Effect.gen(function* () {
    const now = at ?? new Date(yield* Clock.currentTimeMillis)
    const hourStart = new Date(now.getTime() - FAILURE_ALERT_WINDOW_MS)
    const repository = yield* AutomationRunOutcomeRepository
    const failures = yield* repository
      .listFinalFailures({ from: new Date(hourStart.getTime() - FAILURE_ALERT_WINDOW_MS), to: now })
      .pipe(Effect.flatMap((all) => keepNotifiableFailures(app, all, now)))
    const held = yield* (yield* FailureAlertHoldBack).take
    const heldInHistory = selectHeldBackFailures(failures, hourStart, now).filter(
      (failure) => !held.alerted.has(failure.id)
    )
    const groups = mergeRollupGroups(groupHeldBackFailures(heldInHistory), held.groups)
    if (groups.length === 0 && held.overflow === undefined) return { sent: false, automations: [] }
    const automations = yield* withRecovery(groups, held.recoveries)
    const recipients = yield* deliverAutomationNotice({
      app,
      content: rollupNotice(automations, held.overflow, { from: hourStart, to: now }),
    })
    return {
      sent: recipients > 0,
      automations: automations.map(({ name, extraFailures, recoveredAt }) => ({
        name,
        extraFailures,
        recoveredAt,
      })),
    }
  }).pipe(Effect.withSpan('automations.send-failure-rollup'))
