/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-process in-memory `X-Eco-Index` tracker.
 *
 * Records the grades emitted by the eco-index middleware — the most recent
 * one, the cumulative count, the per-grade histogram, and the mean byte size
 * behind them — and exposes all four to the
 * `GET /api/admin/footprint/overview` route handler for the `ecoIndexHeader`
 * panel.
 *
 * ## `currentGrade` is nullable, and that is the correction
 *
 * The tracker used to initialise `currentGrade` to `'A'`, so a freshly booted
 * instance reported grade A alongside `graded: 0` — a top grade awarded before
 * anything had been measured, which is exactly what [internal ref] D6 forbids. There
 * is no honest letter for "nothing graded yet", so the field is `null` until a
 * response is graded. The console renders that as its empty state rather than
 * as an A.
 *
 * ## What the grade actually measures
 *
 * `gradeBytes` grades a response's size in bytes and nothing else — not DOM
 * size, not request count, not the other inputs the EcoIndex.fr methodology
 * uses. That size is whatever the middleware measured: the `Content-Length`
 * header when the response carries one, otherwise the buffered body length
 * for textual responses. It is NOT always the `Content-Length` header — most
 * Hono responses, JSON included, do not set one. `meanBytes` is published
 * beside the histogram so a reader can see the quantity the letters were
 * derived from instead of inferring a richer model behind them.
 *
 * Process-local because the footprint overview is operator telemetry and Sovrium
 * deployments are single-process (or shared-nothing per replica). A
 * multi-replica future would extend this with a Redis-backed aggregator;
 * the tracker shape stays the same.
 */

import { type EcoIndexGrade } from '@/domain/models/process-env/eco/eco-index-header'
import { readTelemetryEpoch } from '@/infrastructure/process/telemetry-epoch'

/** Every grade the middleware can emit, in order. */
const GRADES: readonly EcoIndexGrade[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

/** Count of graded responses per letter grade. */
export type EcoIndexHistogram = Readonly<Record<EcoIndexGrade, number>>

/** Snapshot of the tracker state surfaced to the overview route. */
export interface EcoIndexTrackerSnapshot {
  /** Most recently graded response, or `null` when nothing has been graded. */
  readonly currentGrade: EcoIndexGrade | null
  readonly graded: number
  /** ISO 8601 boot timestamp — the counter epoch for {@link graded}. */
  readonly since: string
  /** Per-grade counts over the same interval as {@link graded}. */
  readonly histogram: EcoIndexHistogram
  /**
   * Mean measured response size, in bytes, across graded responses — or
   * `null` when nothing has been graded. This is the raw quantity the letters
   * were computed from, not necessarily a `Content-Length` header.
   */
  readonly meanBytes: number | null
}

/**
 * A zeroed histogram — the state at boot and after every reset.
 *
 * Deliberately mutable: {@link recordGradedResponse} increments a bucket in
 * place on every response, and the snapshot reader copies before handing it out.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- deliberately mutable per the JSDoc above: the returned histogram is incremented in place by recordGradedResponse
const emptyHistogram = (): Record<EcoIndexGrade, number> =>
  Object.fromEntries(GRADES.map((grade) => [grade, 0])) as Record<EcoIndexGrade, number>

// eslint-disable-next-line functional/no-let -- counter mutated by the middleware
let gradedCount = 0
// eslint-disable-next-line functional/no-let, unicorn/no-null -- last grade mutated by the middleware; `null` (not `undefined`) is the API contract's "nothing graded yet" sentinel
let currentGrade: EcoIndexGrade | null = null
// eslint-disable-next-line functional/no-let, functional/prefer-immutable-types -- per-grade counts are incremented in place on the hot response path; a frozen record would mean re-allocating the histogram once per response
let histogram: Record<EcoIndexGrade, number> = emptyHistogram()
// eslint-disable-next-line functional/no-let -- running byte total mutated by the middleware
let totalBytes = 0

/**
 * Record a graded response. Called by the eco-index middleware on every
 * response when `ECO_INDEX_HEADER=on`.
 *
 * @param grade - Letter grade attached to the response.
 * @param bytes - The measured response size the grade was computed from.
 *   Taken as a parameter rather than re-derived here, so the tracker's mean
 *   can never disagree with the grade the client actually received.
 */
export const recordGradedResponse = (grade: EcoIndexGrade, bytes: number): void => {
  // eslint-disable-next-line functional/no-expression-statements -- counter mutation is the point
  gradedCount += 1
  // eslint-disable-next-line functional/no-expression-statements -- last-grade mutation is the point
  currentGrade = grade
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- histogram mutation is the point
  histogram[grade] += 1
  // eslint-disable-next-line functional/no-expression-statements -- running total mutation is the point
  totalBytes += Number.isFinite(bytes) && bytes > 0 ? bytes : 0
}

/** Read the tracker state (used by the overview route). */
export const readEcoIndexTrackerSnapshot = (): EcoIndexTrackerSnapshot => ({
  currentGrade,
  graded: gradedCount,
  since: readTelemetryEpoch(),
  histogram: { ...histogram },
  // eslint-disable-next-line unicorn/no-null -- `null` is the contract's "nothing graded yet" sentinel, deliberately distinct from a measured 0 bytes
  meanBytes: gradedCount === 0 ? null : Math.round(totalBytes / gradedCount),
})

/**
 * Reset tracker state at server boot.
 *
 * A no-op in production, where the process boots once and the module-load
 * state is already empty. Load-bearing under the E2E harness, which restarts
 * the server between specs inside one Bun process — without it, a prior spec's
 * grades bleed into the next spec's counts. The epoch itself is re-stamped
 * separately by `resetTelemetryEpochAtBoot`, which all three since-boot
 * counters share.
 */
export const resetEcoIndexTrackerAtBoot = (): void => {
  // eslint-disable-next-line functional/no-expression-statements -- boot reset
  gradedCount = 0
  // eslint-disable-next-line functional/no-expression-statements, unicorn/no-null -- boot reset restores the "nothing graded yet" sentinel
  currentGrade = null
  // eslint-disable-next-line functional/no-expression-statements -- boot reset
  histogram = emptyHistogram()
  // eslint-disable-next-line functional/no-expression-statements -- boot reset
  totalBytes = 0
}
