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
 *   3. the run's own database cost: integer `db.query.count`,
 *      `db.transaction.count` and `db.catalog_probe.count` attributes on the
 *      span, and the `automation.run.db.*` histograms (labeled `{ automation }`),
 *      measured as before/after deltas of the current counter box
 *      (`db-query-counter.ts`).
 *
 * The run loop never fails its Effect channel (it folds every failure into a
 * terminal `runStatus`), so the duration/count/status are always recorded on the
 * resolved run.
 */

import { Duration, Effect } from 'effect'
import { currentDbCost, withDbCostBox, type DbCostSnapshot } from './db-query-counter'
import { recordAutomationRun, recordAutomationRunDbCost, type AutomationRunDbCost } from './metrics'

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
  // A run started outside any request or scheduled fire (a resumed delay, a
  // background dispatch) still gets a box of its own, so every run is counted.
  withDbCostBox(
    Effect.flatMap(Effect.sync(currentDbCost), (before) =>
      Effect.timed(run).pipe(
        Effect.tap(([elapsed, result]) =>
          recordAutomationRun(automation, result.status, Duration.toMillis(elapsed) / 1000)
        ),
        Effect.tap(([, result]) => Effect.annotateCurrentSpan('status', result.status)),
        Effect.tap(() => recordRunDbCost(automation, before)),
        Effect.map(([, result]) => result),
        Effect.withSpan('automation.run', { attributes: { automation } })
      )
    )
  )

/** The work done between two snapshots of the same box. */
const costBetween = (before: DbCostSnapshot, after: DbCostSnapshot): AutomationRunDbCost => ({
  statements: after.statements - before.statements,
  transactions: after.transactions - before.transactions,
  catalogProbes: after.catalogProbes - before.catalogProbes,
})

/**
 * Charge the run with the database work done since `before`: the integer
 * `db.query.count` / `db.transaction.count` / `db.catalog_probe.count`
 * attributes on the current (`automation.run`) span, and one observation on
 * each `automation.run.db.*` histogram. A run inside a request reads the
 * request's box, so the delta leaves out the sign-in and routing statements
 * around the run; any other run has a box of its own (`withDbCostBox`). The
 * guard against a missing snapshot is defensive: it records nothing rather
 * than a false zero.
 */
const recordRunDbCost = (
  automation: string,
  before: DbCostSnapshot | undefined
): Effect.Effect<void> =>
  Effect.suspend(() => {
    const after = currentDbCost()
    if (before === undefined || after === undefined) return Effect.void
    const cost = costBetween(before, after)
    return Effect.andThen(
      Effect.annotateCurrentSpan({
        'db.query.count': cost.statements,
        'db.transaction.count': cost.transactions,
        'db.catalog_probe.count': cost.catalogProbes,
      }),
      recordAutomationRunDbCost(automation, cost)
    )
  })
