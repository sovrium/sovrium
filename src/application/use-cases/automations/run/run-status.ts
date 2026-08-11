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
export const toApiStatus = (
  engineStatus:
    | 'success'
    | 'failure'
    | 'timed-out'
    | 'exhausted'
    | 'completed-with-errors'
    | 'skipped'
    | 'cancelled'
    | 'waiting-approval'
    | 'queued'
    | 'running'
):
  | 'completed'
  | 'failed'
  | 'timed-out'
  | 'exhausted'
  | 'completed-with-errors'
  | 'skipped'
  | 'cancelled'
  | 'waiting-approval'
  | 'queued'
  | 'running' => {
  if (engineStatus === 'success') return 'completed'
  if (engineStatus === 'timed-out') return 'timed-out'
  if (engineStatus === 'exhausted') return 'exhausted'
  if (engineStatus === 'completed-with-errors') return 'completed-with-errors'
  if (engineStatus === 'skipped') return 'skipped'
  if (engineStatus === 'cancelled') return 'cancelled'
  // `waiting-approval`: a paused approval run propagates verbatim so
  // the runs API surfaces the non-terminal pause alongside the terminal labels.
  if (engineStatus === 'waiting-approval') return 'waiting-approval'
  if (engineStatus === 'queued') return 'queued'
  if (engineStatus === 'running') return 'running'
  return 'failed'
}

/**
 * Map an engine step's status to the API step status enum. The DB column is
 * plain `text` (no CHECK constraint); per-step `'skipped'` and `'filtered'`
 * are propagated verbatim so the persisted shape matches the in-memory shape
 * ([internal ref] reads step status directly via `findRunSteps`;
 * [internal ref] surfaces the filter halt as `'filtered'`).
 */
export const toApiStepStatus = (
  engineStatus: 'success' | 'failure' | 'filtered' | 'skipped'
): 'completed' | 'failed' | 'filtered' | 'skipped' => {
  if (engineStatus === 'success') return 'completed'
  if (engineStatus === 'skipped') return 'skipped'
  if (engineStatus === 'filtered') return 'filtered'
  return 'failed'
}
