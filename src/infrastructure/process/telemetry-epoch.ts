/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The single boot epoch every process-local footprint counter is measured
 * against.
 *
 * ## Why this is its own module
 *
 * Three counters now accumulate since boot — graded responses
 * (`eco-index-tracker.ts`), page-cache outcomes (`page-cache-service.ts`), and
 * the process metrics derived from `process.uptime()`. If each captured its
 * own `new Date()` at module load, the three would differ by however long
 * module evaluation took, and — far worse — the E2E harness's per-spec boot
 * reset would have to remember to reset all three. Miss one and the dashboard
 * reports a rate over the wrong interval: a number that is not obviously
 * wrong, computed from a denominator nobody checked. That is the exact defect
 * class the footprint surface exists to retire, so the epoch is stated once
 * and read from here.
 *
 * Process-local by design: Sovrium deployments are single-process, or
 * shared-nothing per replica, and every counter reading this epoch is
 * likewise in-memory.
 */

// eslint-disable-next-line functional/no-let -- the boot epoch is captured once at module load and re-captured only by the boot reset
let epoch: string = new Date().toISOString()

/** ISO 8601 timestamp all since-boot counters are measured from. */
export const readTelemetryEpoch = (): string => epoch

/**
 * Re-stamp the epoch at server boot.
 *
 * Called from `api-routes.ts` alongside the counter resets. A no-op in
 * production, where the process boots once and the module-load value is
 * already correct; load-bearing under the E2E harness, which restarts the
 * server between specs inside one Bun process, so a stale epoch would make
 * every rate the next spec reads span two servers.
 */
export const resetTelemetryEpochAtBoot = (): void => {
  // eslint-disable-next-line functional/no-expression-statements -- re-stamping the epoch is the point
  epoch = new Date().toISOString()
}
