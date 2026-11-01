/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How the automations overview counts runs: the 24h tiles' tally and the
 * period series, each splitting routine runs from the runs about something.
 */

import {
  bucketRowsByTimestamp,
  buildDenseBucketGrid,
  coerceTimestampToMs,
  intervalStepMs,
} from '@/domain/kernel/time/time-series-bucketing'
import type {
  AdminAutomationOverviewRow,
  AdminAutomationStatusRow,
} from '@/application/ports/repositories/automations/admin-automations-repository'
import type { AutomationsOverviewSeriesPoint } from '@/domain/models/api/admin/automations'
import type { PeriodWindow } from '@/domain/models/api/admin/envelope/period-preset'

/** Normalize a run's `startedAt ?? createdAt` timestamp to epoch-ms. */
export function rowTimestampMs(row: AdminAutomationOverviewRow): number {
  return coerceTimestampToMs(row.startedAt ?? row.createdAt)
}

/** A bucket's counts: the runs about something, the routine ones, and the failures. */
interface RunTally {
  readonly runs: number
  readonly routineRuns: number
  readonly failures: number
}

const EMPTY_TALLY: RunTally = { runs: 0, routineRuns: 0, failures: 0 }

/** Add one run to a tally: a routine run counts apart, a failure is never routine. */
function tallyRun(acc: RunTally, row: AdminAutomationStatusRow): RunTally {
  return {
    runs: acc.runs + (row.routine ? 0 : 1),
    routineRuns: acc.routineRuns + (row.routine ? 1 : 0),
    failures: acc.failures + (row.status === 'failed' ? 1 : 0),
  }
}

/**
 * Bucket the period-scoped overview rows into the dense
 * `{ runs, routineRuns, failures }` response series via the shared
 * time-series helpers.
 */
export function buildAutomationsSeries(
  window: PeriodWindow,
  rows: ReadonlyArray<AdminAutomationOverviewRow>
): readonly AutomationsOverviewSeriesPoint[] {
  const stepMs = intervalStepMs(window.interval)
  const bucketMap = bucketRowsByTimestamp({
    rows,
    getTimestamp: (row) => row.startedAt ?? row.createdAt,
    stepMs,
    initial: EMPTY_TALLY,
    accumulate: tallyRun,
  })
  return buildDenseBucketGrid({
    fromIso: window.from,
    toIso: window.to,
    stepMs,
    rowsByBucket: bucketMap,
    emptyValue: EMPTY_TALLY,
  })
}

/** Tally a flat row list: the 24h tiles. */
export function tallyRuns(rows: ReadonlyArray<AdminAutomationStatusRow>): RunTally {
  return rows.reduce(tallyRun, EMPTY_TALLY)
}
