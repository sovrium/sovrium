/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-memory automation run history.
 *
 * Stores a fixed-size sliding window per automation name. Used by
 * `GET /api/automations/runs?automationName=X` for tests that observe
 * automation execution side-effects (e.g. APP-AUTOMATION-ENVIRONMENT-004).
 *
 * Important: callers MUST redact secrets BEFORE recording — this store does
 * not perform any redaction itself. See `redact-secrets.ts`.
 */

export interface AutomationRunRecord {
  readonly id: string
  readonly automationName: string
  readonly startedAt: string
  readonly finishedAt: string
  /**
   * Engine-internal status (matches `RunAutomationResult.status`):
   *  - `'success'` / `'failure'` — normal completion paths
   *  - `'timed-out'` — `automation.timeout` fired and aborted the loop
   *    (APP-AUTOMATION-RETRY-006..008)
   *  - `'exhausted'` — an action's retry budget was fully consumed
   *    (APP-AUTOMATION-RETRY-009..011)
   *  - `'completed-with-errors'` — at least one action failed but declared
   *    `continueOnError: true`, so the run completed without halting
   *    (APP-AUTOMATION-RETRY-014)
   */
  readonly status: 'success' | 'failure' | 'timed-out' | 'exhausted' | 'completed-with-errors'
  readonly steps: ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly operator?: string
    /**
     * Per-step terminal status. `'skipped'` is set for actions that were
     * never executed because an earlier step propagated a failure —
     * APP-AUTOMATION-RETRY-012 requires those actions to appear in
     * `steps[]` so callers can audit the run shape.
     */
    readonly status: 'success' | 'failure' | 'skipped'
    readonly error?: string
    readonly props?: Record<string, unknown>
    /**
     * Action handler's `outcome.output` — surfaced by the runs detail
     * endpoint so multi-action regression specs can assert per-step output
     * (DEC-021). Undefined when the action produces no output (filter,
     * stop, state:set without return, etc.).
     */
    readonly output?: Record<string, unknown>
  }>
  readonly error?: string
}

const MAX_RUNS_PER_AUTOMATION = 100

// Module-level singleton, isolated per server process. Tests run with
// fresh server processes so cross-test contamination is impossible.
// eslint-disable-next-line functional/no-let -- module-level mutable state for in-memory store
let runs: ReadonlyArray<AutomationRunRecord> = []

export const recordAutomationRun = (run: AutomationRunRecord): void => {
  // Keep only the most recent N runs per automation to bound memory.
  const sameAutomation = runs.filter((r) => r.automationName === run.automationName)
  const otherRuns = runs.filter((r) => r.automationName !== run.automationName)
  const trimmed =
    sameAutomation.length >= MAX_RUNS_PER_AUTOMATION
      ? sameAutomation.slice(-(MAX_RUNS_PER_AUTOMATION - 1))
      : sameAutomation
  // eslint-disable-next-line functional/no-expression-statements -- module-level mutable state for in-memory store
  runs = [...otherRuns, ...trimmed, run]
}

export const listAutomationRuns = (filter?: {
  readonly automationName?: string
}): ReadonlyArray<AutomationRunRecord> => {
  if (!filter?.automationName) return runs
  return runs.filter((r) => r.automationName === filter.automationName)
}

/**
 * Fallback lookup by run id used by the runs detail route when the DB-backed
 * `AutomationRunRepository.findById` returns nothing (specs that observe the
 * in-memory shape, e.g. redact-secrets).
 */
export const getAutomationRun = (id: string): AutomationRunRecord | undefined =>
  runs.find((r) => r.id === id)

/**
 * Test-only: clear all runs. Not currently called from production code.
 * @public
 */
export const clearAutomationRuns = (): void => {
  // eslint-disable-next-line functional/no-expression-statements -- module-level mutable state for in-memory store
  runs = []
}
