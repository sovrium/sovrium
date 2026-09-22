/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Automation run-loop seam instrumentation.
 *
 * `traceAutomationRun` is the ONE wrapper the shared `executeAutomationRun`
 * run-loop applies to its run Effect — the single orchestrator every trigger
 * funnels through (manual, webhook, cron, record-event, form). It emits BOTH
 * signals for a single run, from the point where the definition name is known
 * upfront and the terminal status is known on completion (never trigger payload
 * / run ids / step output — those never become labels or attributes):
 *
 *   1. an `automation.run` CHILD span carrying `automation` (the definition
 *      name, set at span creation) and `status` (the terminal run status,
 *      annotated once the run resolves). Being an `Effect.withSpan`, it chains
 *      under whatever span is current on the running fiber — so when the run
 *      executes under `runRequestEffect` (the request-edge root `http.server`
 *      span, e.g. a manual trigger), the run span chains under the request root,
 *      giving free request↔run correlation. Off-request runs (cron) still
 *      CREATE the span: `Tracer.Tracer` is a `Context.Reference` whose
 *      `defaultValue` is a NATIVE tracer minting real `NativeSpan`s
 *      (`effect/Tracer.js`), so `withSpan` is never a no-op — with no collector
 *      listening it is one in-memory allocation, dropped unreferenced.
 *   2. `automation.run.duration` (histogram, labeled `{ automation }`) +
 *      `automation.run.count` (sum, labeled `{ automation, status }`)
 *      observations (see `recordAutomationRun` in `metrics.ts`), timed over the
 *      run itself and composed into the Effect so the observation writes the
 *      process-global `Metric` registry the OtlpMetrics poller snapshots —
 *      independent of whether tracing is armed.
 *
 * The run loop never fails its Effect channel (it folds every failure into a
 * terminal `runStatus`), so the duration/count/status are always recorded on the
 * resolved run.
 */

import { Duration, Effect } from 'effect'
import { recordAutomationRun } from './metrics'

/**
 * The minimal shape the seam reads off a completed run — its terminal status.
 * Typed structurally (a `status: string`) so this telemetry helper stays
 * decoupled from the automation domain result type.
 */
interface RunWithStatus {
  readonly status: string
}

/**
 * Wrap an automation-run Effect with the run-loop seam: an `automation.run`
 * child span (`{ automation }` attribute + annotated terminal `status`) plus
 * `automation.run.duration`/`automation.run.count` observations. Preserves the
 * run's success/error/requirement types.
 */
export const traceAutomationRun = <A extends RunWithStatus, E, R>(
  automation: string,
  run: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.timed(run).pipe(
    Effect.tap(([elapsed, result]) =>
      recordAutomationRun(automation, result.status, Duration.toMillis(elapsed) / 1000)
    ),
    Effect.tap(([, result]) => Effect.annotateCurrentSpan('status', result.status)),
    Effect.map(([, result]) => result),
    Effect.withSpan('automation.run', { attributes: { automation } })
  )
