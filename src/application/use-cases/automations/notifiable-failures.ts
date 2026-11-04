/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  AutomationRunOutcomeRepository,
  type AutomationRunOutcomeDatabaseError,
} from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import {
  STREAK_SCAN_LIMIT,
  failureEmailThreshold,
  notifiableFailureIds,
} from '@/domain/models/app/automations/failure-streak-service'
import type { App } from '@/domain/models/app'
import type { FinalFailure } from '@/domain/models/app/automations/automation-run-outcome-service'

/**
 * The failures the hourly roll-up reads, without those of an automation
 * declaring `notify.afterConsecutiveFailures` that do not end a streak that
 * long: a failure below the threshold was neither emailed nor held back, so the
 * roll-up does not count it either. The failures of every other automation pass
 * through untouched. Each automation with a threshold costs one read of its
 * latest runs up to `now`.
 */
export const keepNotifiableFailures = (
  app: App,
  failures: readonly FinalFailure[],
  now: Readonly<Date>
): Effect.Effect<
  readonly FinalFailure[],
  AutomationRunOutcomeDatabaseError,
  AutomationRunOutcomeRepository
> =>
  Effect.gen(function* () {
    const thresholds = new Map(
      [...new Set(failures.map((failure) => failure.automationName))]
        .map((name) => [name, failureEmailThreshold(app.automations, name)] as const)
        .filter(([, threshold]) => threshold > 1)
    )
    if (thresholds.size === 0) return failures
    const repository = yield* AutomationRunOutcomeRepository
    const notifiable = yield* Effect.forEach([...thresholds], ([automationName, threshold]) =>
      repository
        .listStreakRuns({ automationName, before: now, limit: STREAK_SCAN_LIMIT })
        .pipe(Effect.map((runs) => notifiableFailureIds(runs, threshold)))
    )
    const kept = new Set(notifiable.flatMap((ids) => [...ids]))
    return failures.filter(
      (failure) => !thresholds.has(failure.automationName) || kept.has(failure.id)
    )
  }).pipe(Effect.withSpan('automations.keep-notifiable-failures'))
