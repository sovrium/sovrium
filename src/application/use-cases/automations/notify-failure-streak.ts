/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The failure alert of an automation declaring
 * `notify.afterConsecutiveFailures: n` with `n > 1`.
 *
 * Below `n` failures in a row nothing is emailed and nothing is held back. The
 * `n`-th failure in a row is emailed at once, saying how many runs failed in a
 * row and when the first of them failed. From there the failures that end a
 * streak at least `n` long are alerted or held back for the hourly roll-up
 * exactly as every failure of an automation without a threshold is
 * (`notify-platform-failure.ts`), the hour before each one read among them only.
 *
 * The count is read off the run history, so it survives a restart. When the
 * history cannot be read, or did not record this failure (a database refusing
 * writes), the threshold cannot be counted and the caller alerts as it would
 * without one: a failure is never silenced because the count was unavailable.
 */

import { Effect } from 'effect'
import { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import { FailureAlertHoldBack } from '@/application/ports/services/failure-alert-hold-back'
import {
  FAILURE_ALERT_WINDOW_MS,
  type FinalFailure,
} from '@/domain/models/app/automations/automation-run-outcome-service'
import {
  STREAK_SCAN_LIMIT,
  leadingFailureStreak,
  notifiableFailureIds,
  type StreakRun,
} from '@/domain/models/app/automations/failure-streak-service'
import { summariseRunError } from '@/domain/models/app/automations/failure-summary-service'
import { logError } from '@/infrastructure/logging/logger'
import { deliverAutomationNotice, type AutomationNoticeContent } from './automation-notice'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { EmailSender } from '@/application/ports/services/email-sender'
import type { App } from '@/domain/models/app'

interface FailureStreakInput {
  readonly app: App
  readonly automationName: string
  readonly runId: string
  readonly error: string
  readonly failedAt: string
  readonly kind: 'failed' | 'exhausted' | 'timed-out'
}

/** What the alert says once the streak is long enough. */
const streakNotice = (
  input: FailureStreakInput,
  streak: { readonly length: number; readonly firstFailedAt: Date }
): AutomationNoticeContent => {
  const name = input.automationName
  const timedOut = input.kind === 'timed-out'
  return {
    title: timedOut ? `Automation timed out: ${name}` : `Automation failed: ${name}`,
    intro: `The automation "${name}" failed ${streak.length} times in a row, the first at ${streak.firstFailedAt.toISOString()}.`,
    sections: [
      {
        lines: [
          `Automation: ${name}`,
          `Error: ${summariseRunError(input.error)}`,
          `${timedOut ? 'Timed out at' : 'Failed at'}: ${input.failedAt}`,
        ],
      },
    ],
    fallbackLines: [`Run: ${input.runId}`],
  }
}

/** The runs the streak reads, ending at this failure; `undefined` when unreadable. */
const readStreakRuns = (
  input: FailureStreakInput
): Effect.Effect<readonly StreakRun[] | undefined, never, AutomationRunOutcomeRepository> =>
  Effect.gen(function* () {
    const repository = yield* AutomationRunOutcomeRepository
    return yield* repository
      .listStreakRuns({
        automationName: input.automationName,
        before: new Date(new Date(input.failedAt).getTime() + 1),
        limit: STREAK_SCAN_LIMIT,
      })
      .pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[notify-failure-streak] run history unreadable', cause))
        ),
        // effect-swallow: an unreadable history leaves the decision to the
        // caller's ordinary alert, so the failure is still reported.
        Effect.orElseSucceed(() => undefined)
      )
  })

/**
 * The notifiable failures of the hour up to `self`, as the hold-back reads a
 * history: only the failures that end a streak at least `threshold` long.
 */
const notifiableHistory = (
  runs: readonly StreakRun[],
  threshold: number,
  self: FinalFailure
): readonly FinalFailure[] => {
  const notifiable = notifiableFailureIds(runs, threshold)
  const windowStart = self.completedAt.getTime() - FAILURE_ALERT_WINDOW_MS
  return runs
    .filter((run) => notifiable.has(run.id) && run.completedAt.getTime() >= windowStart)
    .map((run) => ({
      id: run.id,
      automationName: self.automationName,
      completedAt: run.completedAt,
      error: run.error,
    }))
}

/**
 * Alert, hold back, or stay silent about a final failure under the threshold.
 * `'unknown'` when the history could not count the streak: the caller then
 * alerts as it would without a threshold.
 */
export const notifyFailureStreak = (
  input: FailureStreakInput,
  threshold: number
): Effect.Effect<
  'handled' | 'unknown',
  never,
  AuthRepository | AutomationRunOutcomeRepository | EmailSender | FailureAlertHoldBack
> =>
  Effect.gen(function* () {
    const runs = yield* readStreakRuns(input)
    const at = runs?.findIndex((run) => run.id === input.runId) ?? -1
    if (runs === undefined || at === -1) return 'unknown' as const
    const upToSelf = runs.slice(at)
    const streak = leadingFailureStreak(upToSelf)
    if (streak.length < threshold || streak.firstFailedAt === undefined) return 'handled' as const
    const self: FinalFailure = {
      id: input.runId,
      automationName: input.automationName,
      completedAt: new Date(input.failedAt),
      error: input.error,
    }
    const holdBack = yield* FailureAlertHoldBack
    const decision = yield* holdBack.decide(self, notifiableHistory(upToSelf, threshold, self))
    if (decision !== 'immediate') return 'handled' as const
    yield* deliverAutomationNotice({
      app: input.app,
      content: streakNotice(input, { length: streak.length, firstFailedAt: streak.firstFailedAt }),
    })
    return 'handled' as const
  }).pipe(Effect.withSpan('automations.notify-failure-streak'))
