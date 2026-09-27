/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Close the runs stuck `running` past their timeout.
 *
 * Every run executes under a timeout — its automation's `timeout`, else the
 * operator default — and the engine closes it as `timed-out` when it exceeds
 * it. A run whose fiber died without finalising it (a defect the run guard
 * could not reach, a hung driver call) would still stay `running` for good,
 * holding the console's attention and never alerting anyone. This sweep is the
 * safety net: a run still `running` a {@link STUCK_RUN_GRACE_MS} past its
 * timeout is closed as `timed-out` with {@link STUCK_RUN_ERROR}, and alerted
 * like any other timeout — the hold-back of repeated alerts applies.
 *
 * The timeout counts from admission, which is when `started_at` is written,
 * so a run that waited long for a concurrency slot is never swept early.
 *
 * Run every five minutes by `register-stuck-run-sweep.ts`, and on demand by
 * the token-gated `POST /api/internal/automations/reap-interrupted`.
 */

import { Effect } from 'effect'
import { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import { STUCK_RUN_ERROR } from '@/domain/models/app/automations/automation-run-outcome-service'
import { resolveAutomationDefaultTimeoutMs } from '@/domain/models/process-env/automations'
import { notifyPlatformFailure } from './notify-platform-failure'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { AutomationRunOutcomeDatabaseError } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import type { App } from '@/domain/models/app'

/** How long past its timeout a run may still be `running` before it is swept. */
export const STUCK_RUN_GRACE_MS = 60_000

/** An automation's own timeout, when it declares a usable one. */
const declaredTimeoutMs = (automation: NonNullable<App['automations']>[number]) => {
  const raw = (automation as { readonly timeout?: number }).timeout
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : undefined
}

/**
 * Close every stuck run and alert each one, answering the ids closed.
 *
 * @param now - the instant the cutoffs are measured from (defaults to now).
 */
export const sweepStuckRuns = (
  app: App,
  processEnv: Readonly<Record<string, string | undefined>> = process.env,
  now: Readonly<Date> = new Date()
): Effect.Effect<
  readonly string[],
  AutomationRunOutcomeDatabaseError,
  AutomationRunOutcomeRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const defaultTimeoutMs = resolveAutomationDefaultTimeoutMs(processEnv)
    const cutoffOf = (timeoutMs: number) => new Date(now.getTime() - timeoutMs - STUCK_RUN_GRACE_MS)
    const repository = yield* AutomationRunOutcomeRepository
    const closed = yield* repository.timeOutStuckRuns({
      cutoffs: (app.automations ?? []).map((automation) => ({
        automationName: automation.name,
        startedBefore: cutoffOf(declaredTimeoutMs(automation) ?? defaultTimeoutMs),
      })),
      defaultStartedBefore: cutoffOf(defaultTimeoutMs),
      error: STUCK_RUN_ERROR,
    })
    const closedAt = new Date().toISOString()
    yield* Effect.forEach(
      closed,
      (run) =>
        notifyPlatformFailure({
          app,
          automationName: run.automationName,
          runId: run.id,
          error: STUCK_RUN_ERROR,
          failedAt: closedAt,
          kind: 'timed-out',
        }),
      { discard: true }
    )
    return closed.map((run) => run.id)
  }).pipe(Effect.withSpan('automations.sweep-stuck-runs'))
