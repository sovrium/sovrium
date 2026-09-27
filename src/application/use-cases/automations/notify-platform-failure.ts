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
 * Contract ([internal ref]..005, -018..-024):
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
 * - Grouped: a final failure is emailed
 *     at once only when no OTHER final failure of the same automation completed
 *     in the hour before it. The rest are held back for the hourly roll-up
 *     (`send-failure-rollup.ts`), so an automation failing every minute sends
 *     one email, then one summary an hour — not sixty. The rule is read from
 *     the run history itself, so the roll-up recomputes it without anything
 *     being recorded here. An interrupted run is always emailed at once: it is
 *     the server's event, not the automation's.
 *
 * Failures inside this helper are swallowed and logged: a broken email path
 * MUST NOT re-fail the already-failed run (that would mask the real automation
 * error in logs and tests).
 */

import { Effect } from 'effect'
import { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import {
  FAILURE_ALERT_WINDOW_MS,
  qualifiesForImmediateAlert,
} from '@/domain/models/app/automations/automation-run-outcome-service'
import { summariseRunError } from '@/domain/models/app/automations/failure-summary-service'
import { logError } from '@/infrastructure/logging/logger'
import { deliverAutomationNotice, type AutomationNoticeContent } from './automation-notice'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { App } from '@/domain/models/app'

/**
 * How the run ended. A timed-out run is told as such, not as a generic failure;
 * an interrupted run is one the server stopped under, closed at the next boot.
 */
export type PlatformFailureKind = 'failed' | 'timed-out' | 'interrupted'

interface NotifyPlatformFailureInput {
  readonly app: App
  readonly automationName: string
  readonly runId: string
  readonly error: string
  readonly failedAt: string
  readonly kind: PlatformFailureKind
  /** The environment to read; defaults to the process environment. */
  readonly env?: Readonly<Record<string, string | undefined>>
}

/** The title and first sentence of the alert, per way the run ended. */
const describeFailure = (
  input: NotifyPlatformFailureInput
): { readonly title: string; readonly intro: string; readonly at: string } => {
  const name = input.automationName
  if (input.kind === 'timed-out') {
    return {
      title: `Automation timed out: ${name}`,
      intro: `The automation "${name}" timed out: the run took longer than its time limit and was stopped.`,
      at: 'Timed out at',
    }
  }
  if (input.kind === 'interrupted') {
    return {
      title: `Automation interrupted: ${name}`,
      intro: `A run of the automation "${name}" never finished: the server stopped while it was running, so it was closed as failed when the server started again.`,
      at: 'Closed at',
    }
  }
  return {
    title: `Automation failed: ${name}`,
    intro: `The automation "${name}" failed after using all of its retries.`,
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
 * the hour before it. An unreadable history degrades to sending: a duplicate
 * email is a nuisance, a lost alert is the failure this exists to prevent.
 */
const isImmediate = (
  input: NotifyPlatformFailureInput
): Effect.Effect<boolean, never, AutomationRunOutcomeRepository> =>
  Effect.gen(function* () {
    if (input.kind === 'interrupted') return true
    const completedAt = new Date(input.failedAt)
    const repository = yield* AutomationRunOutcomeRepository
    const recent = yield* repository.listFinalFailures({
      automationName: input.automationName,
      from: new Date(completedAt.getTime() - FAILURE_ALERT_WINDOW_MS),
      to: new Date(completedAt.getTime() + 1),
    })
    const self = {
      id: input.runId,
      automationName: input.automationName,
      completedAt,
      error: input.error,
    }
    return qualifiesForImmediateAlert(self, recent)
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[notify-platform-failure] failure history unreadable', cause))
    ),
    // effect-swallow: see the doc comment — an unreadable history sends the alert.
    Effect.orElseSucceed(() => true)
  )

/**
 * Dispatch the platform failure alert after a failed, timed-out or interrupted
 * run.
 *
 * Both requirements are DECLARED rather than bound (standing rule E1): the run
 * loop's failure path already runs under the automation runtime, and the boot
 * sweep and its trigger route under the server's.
 */
export const notifyPlatformFailure = (
  input: NotifyPlatformFailureInput
): Effect.Effect<void, never, AuthRepository | AutomationRunOutcomeRepository> =>
  Effect.gen(function* () {
    if (!(yield* isImmediate(input))) return
    yield* deliverAutomationNotice({
      app: input.app,
      content: failureNotice(input),
      env: input.env,
    })
  }).pipe(Effect.withSpan('automations.notify-platform-failure'))
