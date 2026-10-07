/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Close the runs a stopped server left behind.
 *
 * Automation queues live in memory. A server that stops mid-run — a crash, a
 * deploy, `kill -9` — leaves that run `running` (or `queued` for a concurrency
 * slot) in the database forever: nothing in the next process will ever finish
 * it, and the console shows it running for good. So at boot, every such row
 * that was TRIGGERED BEFORE THIS SERVER (its `created_at`) is closed as `failed` with
 * {@link INTERRUPTED_RUN_ERROR}, and each is alerted like any other failure.
 *
 * "Triggered before this server" is exact rather than a timeout guess: no run of
 * this server can predate it. A run waiting for a human approval survives a
 * restart by design and is left alone: it is resumed from the database, not
 * from memory. The repository also spares a run with a delayed step still
 * `waiting` in `automation_delayed_steps` — a guard that is INERT today, since
 * nothing writes that table and a delay runs inside the run's own fiber (a
 * restart loses it like any other in-flight run). It is kept for the day
 * delayed steps are resumed from the database.
 *
 * A run of THIS server stuck `running` past its timeout is not this module's:
 * `sweep-stuck-runs.ts` closes it as `timed-out`.
 *
 * Run at boot by `startServer`, and on demand by the token-gated
 * `POST /api/internal/automations/reap-interrupted`.
 */

import { Effect } from 'effect'
import { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import { INTERRUPTED_RUN_ERROR } from '@/domain/models/app/automations/automation-run-outcome-service'
import { readServerBootInstant } from '@/infrastructure/process/server-boot-instant'
import { notifyPlatformFailure } from './notify-platform-failure'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { AutomationRunOutcomeDatabaseError } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import type { EmailSender } from '@/application/ports/services/email-sender'
import type { App } from '@/domain/models/app'

/**
 * Close every orphaned run and alert each one, answering the ids closed.
 *
 * `startedBefore` defaults to the instant the running server started.
 */
export const reapInterruptedRuns = (
  app: App,
  startedBefore: Readonly<Date> = readServerBootInstant()
): Effect.Effect<
  readonly string[],
  AutomationRunOutcomeDatabaseError,
  AutomationRunOutcomeRepository | AuthRepository | EmailSender
> =>
  Effect.gen(function* () {
    const repository = yield* AutomationRunOutcomeRepository
    const closed = yield* repository.failOrphanedRuns({
      startedBefore,
      error: INTERRUPTED_RUN_ERROR,
    })
    const closedAt = new Date().toISOString()
    yield* Effect.forEach(
      closed,
      (run) =>
        notifyPlatformFailure({
          app,
          automationName: run.automationName,
          runId: run.id,
          error: INTERRUPTED_RUN_ERROR,
          failedAt: closedAt,
          kind: 'interrupted',
        }),
      { discard: true }
    )
    return closed.map((run) => run.id)
  }).pipe(Effect.withSpan('automations.reap-interrupted-runs'))
