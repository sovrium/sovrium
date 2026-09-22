/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin run-retry entry point (Consoles-as-Config CAP-3 — the one net-new
 * backend the campaign deferred).
 *
 * The native admin dashboard's run-detail "Réessayer" gesture targets
 * `POST /api/admin/automations/runs/:runId/retry` — a runId-only path (no
 * automation name in the URL, unlike the schema-author `:name/runs/:id/replay`
 * endpoint). This use-case resolves the run by id, derives its automation name
 * from the persisted row, then delegates to the EXISTING replay engine
 * ({@link replayAutomationRun}) so the retry reuses the side-effects-once
 * resume-from-failure semantics rather than re-implementing run execution.
 *
 * Loading the run first (rather than letting `replayAutomationRun` fail on a
 * missing run) lets the route surface an anti-enumeration 404 (S1) for an
 * unknown runId without leaking whether an id of that shape exists.
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { replayAutomationRun, type ReplayAutomationRunError } from './replay-automation-run'
import type { ExecuteAutomationRunRequirements, RunAutomationResult } from './run-automation'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { App } from '@/domain/models/app'

/** Options for {@link retryAutomationRun}. */
export interface RetryAutomationRunOptions {
  /** The persisted run to re-fire (its automation name is read from the row). */
  readonly runId: string
  /** The live app schema (carries the automation definition + env contract). */
  readonly app: App
  /** Process env passed through to the replay engine (env-var resolution). */
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /** Acting admin's user id, threaded into the new run's audit context. */
  readonly userId?: string
}

/**
 * Retry an automation run by id. Resolves the run → its automation name →
 * the existing {@link replayAutomationRun} engine, which creates a NEW run
 * that skips already-executed actions (side-effects fire once) and never
 * mutates the original run's row.
 *
 * Fails with `AutomationRunNotFound` when the run id is unknown — the route
 * maps that to a 404 (anti-enumeration, S1) — and with the repository's own
 * `AutomationRunDatabaseError` when the store could not be read, which the route
 * must NOT answer as a 404: nothing was learned about whether the run exists.
 */
export const retryAutomationRun = (
  options: RetryAutomationRunOptions
): Effect.Effect<
  RunAutomationResult,
  ReplayAutomationRunError,
  AutomationRunRepository | ExecuteAutomationRunRequirements | AutomationPauseRepository
> =>
  Effect.gen(function* () {
    const { runId, app, processEnv, userId } = options

    const repo = yield* AutomationRunRepository
    // No `mapError`: a read that FAILED is not a read that found nothing. Only
    // the `undefined` row below is an unknown runId, and only it earns the 404.
    const run = yield* repo.findById(runId)
    if (run === undefined) {
      return yield* Effect.fail({ _tag: 'AutomationRunNotFound' as const, runId })
    }

    return yield* replayAutomationRun({
      name: run.automationName,
      runId,
      app,
      processEnv,
      ...(userId !== undefined ? { userId } : {}),
    })
  }).pipe(Effect.withSpan('automations.retry-automation-run'))
