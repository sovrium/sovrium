/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The automation-run status vocabulary, spoken the operator's way.
 *
 * The runs API surfaces the engine's terminal status verbatim
 * (`completed` / `failed` / `completed-with-errors`). Wherever a page reads that
 * API, the `status` field is mapped to its operator-facing label here, so a run
 * reads `Success` rather than `completed` without a server change or a
 * per-column value map in config. A generic system source keeps its raw values:
 * every entry point is gated on {@link isRunsEndpoint}.
 *
 * ─── WHY THIS IS DOMAIN CODE AND NOT AN ISLAND HELPER ──────────────────────
 *
 * It was an island hook helper while the only read of a run was the browser's.
 * A run PAGE reads its run on the SERVER (the page-level `{ system }` binding),
 * and `presentation-render` may not import `presentation-island` — so the
 * choice was a shared home or a second copy of the map. A second copy is how
 * one vocabulary comes to have two spellings on screens that describe the same
 * run: the grid said `Success` while the page it links to said `completed`.
 * Pure data over plain records, so it belongs here rather than in either
 * consumer (the same reasoning as `system-detail-endpoint.ts`).
 */

type RunRecord = Readonly<Record<string, unknown>>

/** Engine status → operator-facing label. A status absent here is left as it arrived. */
export const RUN_STATUS_LABELS: Readonly<Record<string, string>> = {
  completed: 'Success',
  failed: 'Failed',
  'completed-with-errors': 'Partial',
}

/**
 * Does this endpoint publish the automation engine's run vocabulary?
 *
 * Matched on the SEGMENT rather than on the whole path, so the list feed
 * (`/api/admin/automations/runs`) and one run's detail
 * (`/api/admin/automations/runs/:runId`) are both recognised by the one test.
 */
export const isRunsEndpoint = (endpoint: string): boolean => endpoint.includes('/automations/runs')

/** One record's `status`, mapped to its operator-facing label when it has one. */
const localizeStatus = <R extends RunRecord>(row: R): R => {
  const raw = row['status']
  if (typeof raw !== 'string') return row
  const label = RUN_STATUS_LABELS[raw]
  return label ? { ...row, status: label } : row
}

/**
 * One run in the operator's vocabulary — its own status AND each of its steps'.
 *
 * The descent into `steps` is not a generalisation: a run's steps carry the same
 * terminal status the run does, from the same engine, and a run's detail prints
 * them side by side. Localising only the outer one is how one vocabulary comes to
 * have two spellings on a single screen. Anything that is not an object in that
 * array is left exactly as it arrived, since there is no `status` to map.
 */
export const localizeRun = <R extends RunRecord>(row: R): R => {
  const localized = localizeStatus(row)
  const rawSteps = row['steps']
  if (!Array.isArray(rawSteps)) return localized
  return {
    ...localized,
    steps: rawSteps.map((step: unknown) =>
      typeof step === 'object' && step !== null ? localizeStatus(step as RunRecord) : step
    ),
  }
}

/**
 * The single-record entry point, gated on the ENDPOINT alone: a detail binding
 * carries no source id to narrow on, and the endpoint is the discriminating half.
 */
export const localizeRunRecord = <R extends RunRecord>(endpoint: string, record: R): R =>
  isRunsEndpoint(endpoint) ? localizeRun(record) : record
