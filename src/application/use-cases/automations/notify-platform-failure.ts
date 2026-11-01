/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Platform failure notifications.
 *
 * When an automation run ends in failure — its retry budget exhausted, or its
 * whole-run `timeout` exceeded — the platform emails the people who operate the
 * instance, so a failure is never silently lost. Analogous to Zapier's built-in
 * "Zap failed" email.
 *
 * Contract:
 *   - Fires once per run, only AFTER all retries are exhausted (the engine calls
 *     this from the run's post-run dispatch, beside `dispatchFailureHandlers`).
 *   - Recipients: the app's admin-tier accounts, not banned, who left their
 *     "Automation alerts" preference on — plus every address in
 *     `SOVRIUM_NOTIFY_TO`, which is the whole audience of an app with no `auth:`
 *     block. `SOVRIUM_NOTIFY_AUTOMATIONS=off` silences it for the instance.
 *   - Subject: `[<app> v<ver> (Sovrium v<engine>)] Automation failed: <name>`
 *     (`Automation timed out: <name>` for a timed-out run), so the automation
 *     name is searchable and the app is named before the email is opened.
 *   - Body: the automation, the error (escaped in the HTML part — an error
 *     message is data an upstream may have echoed), when it happened, and an
 *     ABSOLUTE link to the console's automations page built from `BASE_URL`.
 *     Without `BASE_URL` there is no address a mail client could open, so the
 *     run id is printed instead of a link that cannot work.
 *   - The footer links to the profile page, where each operator switches the
 *     email off for themselves.
 *   - Grouped: a final failure is emailed
 *     at once only when no OTHER final failure of the same automation completed
 *     in the hour before it. The rest are held back for the hourly roll-up
 *     (`send-failure-rollup.ts`), so an automation failing every minute sends
 *     one email, then one summary an hour — not sixty. The rule is read from
 *     the run history itself, so the roll-up recomputes it without anything
 *     being recorded here — except for a failure the history did not record
 *     (a database refusing writes), which the server's in-memory hold-back
 *     counts instead. Runs a restart interrupted are not alerted here: the
 *     sweep that closes them sends one email for the whole restart
 *     (`reap-interrupted-runs.ts`).
 *
 * Failures inside this helper are swallowed and logged: a broken email path
 * MUST NOT re-fail the already-failed run (that would mask the real automation
 * error in logs and tests).
 */

import { Effect } from 'effect'
import { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import { FailureAlertHoldBack } from '@/application/ports/services/failure-alert-hold-back'
import { FAILURE_ALERT_WINDOW_MS } from '@/domain/models/app/automations/automation-run-outcome-service'
import { summariseRunError } from '@/domain/models/app/automations/failure-summary-service'
import { logError } from '@/infrastructure/logging/logger'
import { deliverAutomationNotice, type AutomationNoticeContent } from './automation-notice'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { EmailSender } from '@/application/ports/services/email-sender'
import type { App } from '@/domain/models/app'

/**
 * How the run ended. A timed-out run is told as such, not as a generic failure.
 * `exhausted` is a failure after a retry policy spent every attempt it allowed,
 * and is the only kind whose alert mentions retries.
 */
export type PlatformFailureKind = 'failed' | 'exhausted' | 'timed-out'

interface NotifyPlatformFailureInput {
  readonly app: App
  readonly automationName: string
  readonly runId: string
  readonly error: string
  readonly failedAt: string
  readonly kind: PlatformFailureKind
}

/** The title and first sentence of the alert, per way the run ended. */
export const describeFailure = (
  input: Pick<NotifyPlatformFailureInput, 'automationName' | 'kind'>
): { readonly title: string; readonly intro: string; readonly at: string } => {
  const name = input.automationName
  if (input.kind === 'timed-out') {
    return {
      title: `Automation timed out: ${name}`,
      intro: `The automation "${name}" timed out: the run took longer than its time limit and was stopped.`,
      at: 'Timed out at',
    }
  }
  return {
    title: `Automation failed: ${name}`,
    intro:
      input.kind === 'exhausted'
        ? `The automation "${name}" failed after using all of its retries.`
        : `The automation "${name}" failed.`,
    at: 'Failed at',
  }
}

/** What the alert says. Pure: every value it prints arrives as a parameter. */
const failureNotice = (input: NotifyPlatformFailureInput): AutomationNoticeContent => {
  const { title, intro, at } = describeFailure(input)
  return {
    title,
    intro,
    sections: [
      {
        lines: [
          `Automation: ${input.automationName}`,
          `Error: ${summariseRunError(input.error)}`,
          `${at}: ${input.failedAt}`,
        ],
      },
    ],
    // Without BASE_URL no link can be built, so the run id is what an operator
    // searches the console's run history for.
    fallbackLines: [`Run: ${input.runId}`],
  }
}

/**
 * Whether this failure is emailed at once, or held back for the hourly
 * roll-up because another final failure of the same automation completed in
 * the hour before it.
 *
 * The run history decides when it recorded this failure. When it did not — the
 * database refused the write, or could not be read — the server's in-memory
 * hold-back decides instead (`FailureAlertHoldBack`), so a full disk does not
 * turn every failure into an email.
 */
const isImmediate = (
  input: NotifyPlatformFailureInput
): Effect.Effect<boolean, never, AutomationRunOutcomeRepository | FailureAlertHoldBack> =>
  Effect.gen(function* () {
    const completedAt = new Date(input.failedAt)
    const repository = yield* AutomationRunOutcomeRepository
    const history = yield* repository
      .listFinalFailures({
        automationName: input.automationName,
        from: new Date(completedAt.getTime() - FAILURE_ALERT_WINDOW_MS),
        to: new Date(completedAt.getTime() + 1),
      })
      .pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[notify-platform-failure] failure history unreadable', cause))
        ),
        // effect-swallow: an unreadable history leaves the decision to the
        // in-memory hold-back, which still sends the first alert of the hour.
        Effect.orElseSucceed(() => undefined)
      )
    const self = {
      id: input.runId,
      automationName: input.automationName,
      completedAt,
      error: input.error,
    }
    const holdBack = yield* FailureAlertHoldBack
    return (yield* holdBack.decide(self, history)) === 'immediate'
  })

/**
 * Dispatch the platform failure alert after a failed or timed-out run.
 *
 * Every requirement is DECLARED rather than bound (standing rule E1): the run
 * loop's failure path already runs under the automation runtime, and the
 * stuck-run sweep and its trigger route under the server's.
 */
export const notifyPlatformFailure = (
  input: NotifyPlatformFailureInput
): Effect.Effect<
  void,
  never,
  AuthRepository | AutomationRunOutcomeRepository | EmailSender | FailureAlertHoldBack
> =>
  Effect.gen(function* () {
    if (!(yield* isImmediate(input))) return
    yield* deliverAutomationNotice({ app: input.app, content: failureNotice(input) })
  }).pipe(Effect.withSpan('automations.notify-platform-failure'))
