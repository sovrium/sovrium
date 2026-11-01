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
 * {@link INTERRUPTED_RUN_ERROR}. The operators — the same recipients, under the
 * same preferences, as every failure alert — receive ONE email for the sweep,
 * naming each automation with how many of its runs were interrupted: a restart
 * is one event, however many runs it caught. Each closed run keeps what its
 * trigger's history level keeps (`run/run-history-drop.ts`).
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
import {
  INTERRUPTED_RUN_ERROR,
  countInterruptedRuns,
  type InterruptedRunCount,
} from '@/domain/models/app/automations/automation-run-outcome-service'
import { onDevTimeline, readServerBootInstant } from '@/infrastructure/process/server-boot-instant'
import { deliverAutomationNotice, type AutomationNoticeContent } from './automation-notice'
import { dropClosedRunHistory } from './run/run-history-drop'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { AutomationRunOutcomeDatabaseError } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import type { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import type { EmailSender } from '@/application/ports/services/email-sender'
import type { App } from '@/domain/models/app'

/** One line per automation: its name and how many of its runs were interrupted. */
const countLine = ({ name, runs }: InterruptedRunCount): string =>
  `${name}: ${runs} ${runs === 1 ? 'run' : 'runs'} interrupted`

/**
 * What the restart's one email says. The subject names every automation, so
 * an operator searching for one finds it; the body counts each one's runs.
 */
const interruptedNotice = (
  counts: readonly InterruptedRunCount[],
  closedAt: string
): AutomationNoticeContent => {
  const names = counts.map((count) => count.name).join(', ')
  const total = counts.reduce((sum, count) => sum + count.runs, 0)
  return {
    title:
      counts.length === 1
        ? `Automation interrupted: ${names}`
        : `Automations interrupted: ${names}`,
    intro: `The server stopped while ${total === 1 ? 'a run was' : `${total} runs were`} in progress, so ${total === 1 ? 'it was' : 'they were'} closed as failed when the server started again. Nothing in the automations themselves failed.`,
    sections: [
      { lines: counts.map(countLine) },
      { lines: [`Error: ${INTERRUPTED_RUN_ERROR}`, `Closed at: ${closedAt}`] },
    ],
  }
}

/**
 * Close every orphaned run and tell the operators in ONE email for the whole
 * sweep, answering the ids closed. A sweep that closed nothing sends nothing.
 *
 * `startedBefore` defaults to the instant the running server started.
 */
export const reapInterruptedRuns = (
  app: App,
  startedBefore: Readonly<Date> = readServerBootInstant()
): Effect.Effect<
  readonly string[],
  AutomationRunOutcomeDatabaseError,
  AutomationRunOutcomeRepository | AutomationRunRepository | AuthRepository | EmailSender
> =>
  Effect.gen(function* () {
    const repository = yield* AutomationRunOutcomeRepository
    // Compared on the timeline the rows were stamped on: a pinned development
    // host stamps its runs from the pinned instant, so its boot is that instant.
    const closed = yield* repository.failOrphanedRuns({
      startedBefore: onDevTimeline(startedBefore),
      error: INTERRUPTED_RUN_ERROR,
    })
    yield* Effect.forEach(
      closed,
      (run) =>
        dropClosedRunHistory({
          app,
          automationName: run.automationName,
          triggerName: run.triggerName,
          status: 'failed',
          runId: run.id,
        }),
      { discard: true }
    )
    if (closed.length > 0) {
      const content = interruptedNotice(countInterruptedRuns(closed), new Date().toISOString())
      yield* deliverAutomationNotice({ app, content })
    }
    return closed.map((run) => run.id)
  }).pipe(Effect.withSpan('automations.reap-interrupted-runs'))
