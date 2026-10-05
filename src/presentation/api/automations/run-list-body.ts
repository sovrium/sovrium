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

import { redactTriggerDataHeaders } from '@/domain/kernel/sanitize/http-header-redaction'
import { judgedRunOf } from './run-step-output-reach'
import type {
  PersistedRun,
  PersistedStep,
} from '@/application/ports/repositories/automations/automation-run-repository'
import type { App } from '@/domain/models/app'

/**
 * Resolve a run's trigger type by looking up its automation in the schema.
 * Defaults to `'webhook'` when the automation has been removed from the schema
 * mid-flight (the run row outlives the definition reference).
 */
const lookupTriggerType = (app: App, name: string): string =>
  app.automations?.find((a) => a.name === name)?.trigger.type ?? 'webhook'

/**
 * Compute the attempt count for a run from its step rows. When a step has
 * an `attempts: [...]` array on its `output` (populated by
 * `dispatchWithRetry` — [internal ref]), the run's attempt count
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
 * the `steps` parameter to surface the real retry count
 *.
 */
const persistedRunToApi = (app: App, run: PersistedRun, steps?: ReadonlyArray<PersistedStep>) => ({
  id: run.id,
  automationName: run.automationName,
  status: run.status,
  triggerType: lookupTriggerType(app, run.automationName),
  // A webhook trigger captures EVERY inbound request header, the caller's own
  // credential included. Step `output` was already scrubbed; `triggerData` was
  // not, so the run history reflected `Authorization: Bearer <webhook secret>`
  // back verbatim.
  triggerData: redactTriggerDataHeaders(run.triggerData),
  startedAt: run.startedAt,
  completedAt: run.completedAt,
  durationMs: run.durationMs,
  attempt: steps !== undefined ? computeAttemptCount(steps) : 1,
  error: run.error,
  valuesErasedAt: run.valuesErasedAt,
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
