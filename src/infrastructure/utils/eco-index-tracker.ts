/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-process in-memory `X-Eco-Index` tracker.
 *
 * Records the most recent grade emitted by the eco-index middleware plus a
 * cumulative count since boot, and exposes both to the
 * `GET /api/admin/eco/overview` route handler for the `ecoIndexHeader`
 * panel.
 *
 * Process-local because the eco overview is operator telemetry and Sovrium
 * deployments are single-process (or shared-nothing per replica). A
 * multi-replica future would extend this with a Redis-backed aggregator;
 * the tracker shape stays the same.
 */

import { type EcoIndexGrade } from '@/domain/models/env/eco/eco-index-header'

/** Snapshot of the tracker state surfaced to the overview route. */
export interface EcoIndexTrackerSnapshot {
  readonly currentGrade: EcoIndexGrade
  readonly graded: number
  /** ISO 8601 boot timestamp — the counter epoch for `graded`. */
  readonly since: string
}

// eslint-disable-next-line functional/no-let -- in-memory boot epoch, captured once at module load
let bootTimestamp: string = new Date().toISOString()
// eslint-disable-next-line functional/no-let -- counter mutated by the middleware
let gradedCount = 0
// eslint-disable-next-line functional/no-let -- last grade mutated by the middleware
let currentGrade: EcoIndexGrade = 'A'

/**
 * Record a graded response. Called by the eco-index middleware on every
 * response when `ECO_INDEX_HEADER=on`.
 */
export const recordGradedResponse = (grade: EcoIndexGrade): void => {
  // eslint-disable-next-line functional/no-expression-statements -- counter mutation is the point
  gradedCount += 1
  // eslint-disable-next-line functional/no-expression-statements -- last-grade mutation is the point
  currentGrade = grade
}

/** Read the tracker state (used by the overview route). */
export const readEcoIndexTrackerSnapshot = (): EcoIndexTrackerSnapshot => ({
  currentGrade,
  graded: gradedCount,
  since: bootTimestamp,
})

/**
 * Reset tracker state. Test-only — the production tracker is never reset
 * (the boot epoch is, by definition, immutable). The reset is exposed so
 * unit tests can exercise the counter logic without process restart.
 */
export const resetEcoIndexTrackerForTesting = (): void => {
  // eslint-disable-next-line functional/no-expression-statements -- test-only reset
  bootTimestamp = new Date().toISOString()
  // eslint-disable-next-line functional/no-expression-statements -- test-only reset
  gradedCount = 0
  // eslint-disable-next-line functional/no-expression-statements -- test-only reset
  currentGrade = 'A'
}
