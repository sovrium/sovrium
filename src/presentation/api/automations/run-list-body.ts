/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The body of one run in `GET /api/automations/runs`, beside the run as the
 * reach judgement reads it (`run-step-output-reach.ts`).
 */

import { redactRunTriggerData } from '@/domain/models/app/automations/trigger/webhook-credential-headers-service'
import {
  runTriggerOf,
  triggerNameFilterOf as runTriggerNameFilterOf,
  type RunTrigger,
  type TriggerNameFilter,
} from '@/domain/models/app/automations/trigger-entries-service'
import { judgedRunOf } from './run-step-output-reach'
import type {
  PersistedRun,
  PersistedStep,
} from '@/application/ports/repositories/automations/automation-run-repository'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * A run's trigger, type and name: the name it recorded, its type read from the
 * automation's entry of that name (see `runTriggerOf`). The run row outlives
 * its automation, which may have left the config since.
 */
export const runTriggerFields = (app: App, run: PersistedRun): RunTrigger =>
  runTriggerOf(
    app.automations?.find((a) => a.name === run.automationName),
    run.triggerName
  )

/** A run's `triggerData` as a read returns it: credential headers hidden (`redactRunTriggerData`). */
export const runTriggerDataOf = (app: App, run: PersistedRun): unknown =>
  redactRunTriggerData(
    run.triggerData,
    app.automations?.find((a) => a.name === run.automationName)
  )

/** The `?triggerName=` filter of the public history (see the domain's `triggerNameFilterOf`). */
export const triggerNameFilterOf = (
  app: App,
  automationName: string | undefined,
  triggerName: string
): TriggerNameFilter => runTriggerNameFilterOf(app.automations, automationName, triggerName)

/**
 * Compute the attempt count for a run from its step rows. When a step has
 * an `attempts: [...]` array on its `output` (populated by
 * `dispatchWithRetry` — an automation retry spec), the run's attempt count
 * is the length of the largest such array across all steps. Falls back to
 * 1 when no step carried attempt history (the common no-retry path).
 */
const computeAttemptCount = (steps: ReadonlyArray<{ readonly output?: unknown }>): number => {
  const counts = steps
    .map(({ output }) => {
      if (output === null || output === undefined || typeof output !== 'object') return 0
      const { attempts } = output as { attempts?: unknown }
      return Array.isArray(attempts) ? attempts.length : 0
    })
    .filter((n) => n > 0)
  return counts.length === 0 ? 1 : Math.max(...counts)
}

/**
 * Map a `PersistedRun` row to the public `Run` shape (Zod `runSchema`).
 * Pulled out so the list/filter handler stays under the complexity cap.
 *
 * `attempt` defaults to 1 when no per-step attempt history is supplied.
 * Callers with access to the step rows (the list handler) pass them via
 * the `steps` parameter to surface the real retry count.
 */
const persistedRunToApi = (app: App, run: PersistedRun, steps?: ReadonlyArray<PersistedStep>) => ({
  id: run.id,
  automationName: run.automationName,
  status: run.status,
  ...runTriggerFields(app, run),
  triggerData: runTriggerDataOf(app, run),
  startedAt: run.startedAt,
  completedAt: run.completedAt,
  durationMs: run.durationMs,
  attempt: steps !== undefined ? computeAttemptCount(steps) : 1,
  error: run.error,
  valuesErasedAt: run.valuesErasedAt,
  resumeAt: run.resumeAt,
})

/** Each listed run: its access, its body, and the run as the judgement reads it. */
export const listedRuns = (
  app: App,
  runs: readonly PersistedRun[],
  stepsPerRun: ReadonlyArray<readonly PersistedStep[]>
) =>
  runs.map(
    (run, i) =>
      [
        run,
        persistedRunToApi(app, run, stepsPerRun[i]),
        judgedRunOf(run, stepsPerRun[i] ?? []),
      ] as const
  )

/** The `GET /api/automations/runs` query parameters, numbers parsed. */
export const readListRunsQuery = (c: Context) => {
  const pageStr = c.req.query('page')
  const pageSizeStr = c.req.query('pageSize')
  return {
    automationName: c.req.query('automationName'),
    status: c.req.query('status'),
    triggerName: c.req.query('triggerName'),
    page: pageStr !== undefined ? Number(pageStr) : undefined,
    pageSize: pageSizeStr !== undefined ? Number(pageSizeStr) : undefined,
  }
}
