/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Engine-status → API-status mappers for the automation run loop.
 *
 * Extracted from `run-automation.ts` (P1.2 decomposition). The two
 * mappers are deliberately kept separate: `toApiStatus` and
 * `toApiStepStatus` operate on different input/output enums (a run can be
 * `'timed-out' | 'exhausted' | 'completed-with-errors'`; a step can be
 * `'skipped'`). They are NOT genuine twins — their bodies only coincide on
 * the `success → completed` and the `failed` fallback. Collapsing them
 * would require widening both enums and re-introducing branches, so they
 * stay distinct (matches the documented run-loop status contract).
 */

/**
 * Map the engine's internal status to the public API status enum exposed
 * via `system.automation_runs.status` and the runs API. `'timed-out'`
 * propagates verbatim — the runs API contract surfaces it as a distinct
 * terminal status alongside `'completed'` and `'failed'` so callers can
 * tell a hard timeout from a routine failure.
 *
 * The richer enum (pending/running/skipped/cancelled/etc.) is reserved
 * for future migration specs that grow more execution states.
 */
/** An engine run status, as the run loop and the persisted rows carry it. */
export type EngineRunStatus =
  | 'success'
  | 'failure'
  | 'timed-out'
  | 'exhausted'
  | 'completed-with-errors'
  | 'skipped'
  | 'cancelled'
  | 'waiting-approval'
  | 'waiting-delay'
  | 'queued'
  | 'running'

/** The public label of a run status: every engine label but two passes verbatim. */
export type ApiRunStatus = Exclude<EngineRunStatus, 'success' | 'failure'> | 'completed' | 'failed'

export const toApiStatus = (engineStatus: EngineRunStatus): ApiRunStatus => {
  if (engineStatus === 'success') return 'completed'
  // `failure` is `failed`; every other label — the timed-out and exhausted
  // terminals, the waits for an approval (`waiting-approval`) or a long delay
  // (`waiting-delay`), the scheduler's `queued`/`running` — propagates verbatim.
  if (engineStatus === 'failure') return 'failed'
  return engineStatus
}

/**
 * Map an engine step's status to the API step status enum. The DB column is
 * plain `text` (no CHECK constraint); per-step `'skipped'` and `'filtered'`
 * are propagated verbatim so the persisted shape matches the in-memory shape
 * (an automation retry spec reads step status directly via `findRunSteps`;
 * an API automation runs spec surfaces the filter halt as `'filtered'`).
 */
export const toApiStepStatus = (
  engineStatus: 'success' | 'failure' | 'filtered' | 'skipped' | 'waiting'
): 'completed' | 'failed' | 'filtered' | 'skipped' | 'waiting' => {
  if (engineStatus === 'success') return 'completed'
  // A loop or a path the run parked inside: its row is completed at resume.
  if (engineStatus === 'waiting') return 'waiting'
  if (engineStatus === 'skipped') return 'skipped'
  if (engineStatus === 'filtered') return 'filtered'
  return 'failed'
}
