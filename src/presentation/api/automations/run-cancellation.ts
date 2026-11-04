/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationApprovalRepository } from '@/application/ports/repositories/automations/automation-approval-repository'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { AutomationScheduler } from '@/application/ports/services/automation-scheduler'
import { BrowserDriver } from '@/application/ports/services/browser-driver'
import { dropClosedRunHistory } from '@/application/use-cases/automations/run/run-history-drop'
import type { App } from '@/domain/models/app'

/**
 * The cancellable statuses no fiber is behind: a run waiting on an answer ended
 * its segment. Every other one is under way, or may be: its own finaliser, which
 * still needs what the run holds, closes it by its history level.
 */
const STATUSES_WITHOUT_A_FIBER: ReadonlySet<string> = new Set([
  'waiting-approval',
  'pending',
  'retrying',
])

/** Cancel one run that can still be cancelled: its request, its row, its fiber, its history. */
export const closeCancelledRun = (
  app: App,
  id: string,
  run: {
    readonly automationName: string
    readonly triggerName?: string | null
    readonly status: string
  }
) =>
  Effect.gen(function* () {
    const scheduler = yield* AutomationScheduler
    // Fire the in-memory flag first so any concurrent finaliser sees it
    // before it updates the row. `signalCancellation` answers `false` when
    // no run holds a registration (i.e. the run already terminated). The
    // boolean is ignored — a missing registration is normal for runs that
    // already completed; the DB UPDATE below is the durable signal.
    yield* scheduler.signalCancellation(id)
    // A run parked on a browser confirmation: its held browser closes now, and
    // with it the hold's timer, which would otherwise end the run as abandoned.
    yield* (yield* BrowserDriver).releaseHeld(id)
    const approvals = yield* AutomationApprovalRepository
    const pendingId = yield* approvals.findPendingIdByRunId(id)
    const claimed =
      pendingId === undefined
        ? undefined
        : yield* approvals.resolvePending({ id: pendingId, status: 'rejected' })
    const repo = yield* AutomationRunRepository
    const { automationName, triggerName, status: current } = run
    const keepHistoryLevel = dropClosedRunHistory({
      app,
      automationName,
      triggerName,
      status: 'cancelled',
      runId: id,
    })
    if (
      current === 'waiting-delay' &&
      (yield* repo.cancelWaitingRun({ id, error: 'Run cancelled' }))
    ) {
      yield* keepHistoryLevel
      return yield* repo.findById(id)
    }
    // A run resumed meanwhile has registered its canceller: abort it too.
    const underWay = yield* scheduler.signalCancellation(id)
    const closed = yield* repo.updateStatus({ id, status: 'cancelled' })
    // An approver who answered first has resumed the run: it is not this cancel's to clear.
    const answeredFirst = pendingId !== undefined && claimed === undefined
    if (
      closed !== undefined &&
      !underWay &&
      !answeredFirst &&
      STATUSES_WITHOUT_A_FIBER.has(current)
    ) {
      yield* keepHistoryLevel
    }
    return closed
  })
