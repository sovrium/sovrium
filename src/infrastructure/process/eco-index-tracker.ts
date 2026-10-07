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
 * ## `currentGrade` is nullable, deliberately
 *
 * Initialising `currentGrade` to `'A'` would make a freshly booted instance
 * report grade A alongside `graded: 0` — a top grade awarded before anything
 * has been measured, which is exactly what [internal ref] D6 forbids. There
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
const emptyHistogram = (): Record<EcoIndexGrade, number> =>
  Object.fromEntries(GRADES.map((grade) => [grade, 0])) as Record<EcoIndexGrade, number>

let gradedCount = 0
let currentGrade: EcoIndexGrade | null = null
let histogram: Record<EcoIndexGrade, number> = emptyHistogram()
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
  gradedCount += 1
  currentGrade = grade
  histogram[grade] += 1
  totalBytes += Number.isFinite(bytes) && bytes > 0 ? bytes : 0
}

/** Read the tracker state (used by the overview route). */
export const readEcoIndexTrackerSnapshot = (): EcoIndexTrackerSnapshot => ({
  currentGrade,
  graded: gradedCount,
  since: readTelemetryEpoch(),
  histogram: { ...histogram },
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
  gradedCount = 0
  currentGrade = null
  histogram = emptyHistogram()
  totalBytes = 0
}
