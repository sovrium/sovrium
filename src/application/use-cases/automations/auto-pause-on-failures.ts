/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The automatic operational pause.
 *
 * With `SOVRIUM_AUTOMATION_AUTOPAUSE=<n>`, an automation whose last `n` ended
 * runs are all final failures is paused by the platform itself — the SAME pause
 * an operator sets from the console (one row in `system.automation_pauses`, read
 * by every trigger gate), told apart by its `reason`, `'consecutive-failures'`.
 *
 * Three rules shape the count:
 *
 *   - Only runs that ENDED count. A skipped or cancelled run says nothing about
 *     whether the automation works, and one waiting for an approval has not
 *     ended — none of them breaks or extends a streak.
 *   - Only runs started after the automation was last RESUMED count. An operator
 *     who resumes an automation has told the platform the problem is being
 *     fixed; failures before that are history, not a reason to pause it again.
 *     The last resume is read from the audit log, which records every one.
 *   - The pause is `ON CONFLICT DO NOTHING`, so two runs failing at once cannot
 *     pause twice, and only the call that created the pause audits and emails.
 *
 * Off unless the variable is set: stopping a workflow is a decision the
 * operator opts into. Everything here is best-effort — the run it follows has
 * already failed, and a broken pause path must not turn that into an error.
 */

import { Data, Effect } from 'effect'
import {
  AutomationPauseRepository,
  type AutomationPauseDatabaseError,
} from '@/application/ports/repositories/automations/automation-pause-repository'
import { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import { emitAuditEvent, listAuditEvents } from '@/application/use-cases/admin/audit-log/emit'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  AUTO_PAUSE_REASON,
  isFailureStreak,
} from '@/domain/models/app/automations/automation-run-outcome-service'
import { parseSovriumAutomationAutopause } from '@/domain/models/process-env/notifications'
import { logError } from '@/infrastructure/logging/logger'
import { deliverAutomationNotice, type AutomationNoticeContent } from './automation-notice'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { App } from '@/domain/models/app'

/** The audit log could not be read or written. */
class AutoPauseAuditError extends Data.TaggedError('AutoPauseAuditError')<{
  readonly cause: unknown
}> {}

/** When `automationName` was last resumed, from the audit log; `undefined` if never. */
const lastResumedAt = (
  automationName: string
): Effect.Effect<Date | undefined, AutoPauseAuditError> =>
  Effect.tryPromise({
    try: () =>
      listAuditEvents({ action: AUDIT_ACTIONS.AUTOMATION_RESUMED, resourceId: automationName }),
    catch: (cause) => new AutoPauseAuditError({ cause }),
  }).pipe(
    Effect.map((entries) => {
      const newest = entries[0]
      return newest === undefined ? undefined : new Date(newest.timestamp)
    })
  )

/** The audit entry of an automatic pause. Its actor is the platform, not a person. */
const auditAutoPause = (
  automationName: string,
  threshold: number
): Effect.Effect<void, AutoPauseAuditError> =>
  Effect.tryPromise({
    try: () =>
      emitAuditEvent({
        action: AUDIT_ACTIONS.AUTOMATION_AUTO_PAUSED,
        // eslint-disable-next-line unicorn/no-null -- the actor contract is `null` for system actors
        actor: { id: null, type: 'system', role: 'system' },
        resourceId: automationName,
        severity: 'warning',
        result: 'success',
        metadata: { reason: AUTO_PAUSE_REASON, threshold },
      }),
    catch: (cause) => new AutoPauseAuditError({ cause }),
  })

/** What the pause notice says. */
const autoPauseNotice = (automationName: string, threshold: number): AutomationNoticeContent => ({
  title: `Automation paused: ${automationName}`,
  intro: `The automation "${automationName}" was paused automatically after failing ${threshold} times in a row. It will not run again until someone resumes it.`,
  sections: [
    { lines: [`Automation: ${automationName}`] },
    // The closing line, just above the console button.
    { lines: ['Fix the cause, then resume it from the console.'] },
  ],
})

/** Pause, then audit and announce — only when this call created the pause. */
const pauseAndAnnounce = (
  app: App,
  automationName: string,
  threshold: number
): Effect.Effect<
  void,
  AutoPauseAuditError | AutomationPauseDatabaseError,
  AutomationPauseRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const pauses = yield* AutomationPauseRepository
    const created = yield* pauses.pause({ automationName, reason: AUTO_PAUSE_REASON })
    if (!created) return
    yield* auditAutoPause(automationName, threshold)
    yield* deliverAutomationNotice({ app, content: autoPauseNotice(automationName, threshold) })
  })

/**
 * After a final failure of `automationName`, pause it if its last N ended runs
 * since its last resume are all final failures, N being
 * `SOVRIUM_AUTOMATION_AUTOPAUSE`. A no-op when the variable is unset.
 */
export const autoPauseOnFailures = (input: {
  readonly app: App
  readonly automationName: string
  readonly env?: Readonly<Record<string, string | undefined>> | undefined
}): Effect.Effect<
  void,
  never,
  AutomationRunOutcomeRepository | AutomationPauseRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const threshold = parseSovriumAutomationAutopause(input.env ?? process.env)
    if (threshold === undefined) return
    const resumedAt = yield* lastResumedAt(input.automationName)
    const runs = yield* AutomationRunOutcomeRepository
    const statuses = yield* runs.listRecentEndedStatuses({
      automationName: input.automationName,
      limit: threshold,
      startedAfter: resumedAt,
    })
    if (!isFailureStreak(statuses, threshold)) return
    yield* pauseAndAnnounce(input.app, input.automationName, threshold)
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[auto-pause-on-failures] automatic pause failed', cause, {
          automation: input.automationName,
        })
      )
    ),
    // effect-swallow: the run this follows has already failed; a broken pause
    // path is logged above and must not turn that failure into another.
    Effect.ignoreCause,
    Effect.withSpan('automations.auto-pause-on-failures')
  )
