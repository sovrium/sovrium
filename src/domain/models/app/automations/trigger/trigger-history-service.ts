/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * When a run's history is reduced to its row alone.
 *
 * A trigger declaring `history: 'minimal'` keeps, once its run ENDS, the run
 * row only — status, trigger name, timings, error — without trigger data or
 * steps. While the run is queued, running or paused (an approval, a long
 * delay) it keeps everything: the resume path reads the trigger data and the
 * earlier steps' outputs. A trigger declaring `history: 'none'` keeps the same
 * row for a run that does not succeed, and no row at all for one that does.
 */

import type { TriggerHistory } from './trigger-history'

/** The run statuses after which a run still goes on. */
const UNFINISHED_RUN_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'queued',
  'running',
  'waiting-approval',
  'waiting-delay',
])

/** Whether a run in this status has ended. */
export const hasRunEnded = (status: string): boolean => !UNFINISHED_RUN_STATUSES.has(status)

/** The run statuses, engine and public spellings, of a run that succeeded. */
const SUCCEEDED_RUN_STATUSES: ReadonlySet<string> = new Set([
  'success',
  'completed',
  'completed-with-errors',
])

/**
 * Whether a trigger keeps at most the run row of the runs it starts: a
 * `minimal` trigger, and a `none` one, whose failed runs keep that row.
 */
export const keepsMinimalHistory = (
  trigger: { readonly history?: TriggerHistory } | undefined
): boolean => trigger?.history === 'minimal' || trigger?.history === 'none'

/**
 * Whether a run of `trigger` that reached `status` keeps no row at all: a
 * `none` trigger, and a run that succeeded. A run that failed, timed out, was
 * exhausted, rejected or cancelled keeps its minimal row, with its error.
 */
export const dropsRunRow = (
  trigger: { readonly history?: TriggerHistory } | undefined,
  status: string
): boolean => trigger?.history === 'none' && SUCCEEDED_RUN_STATUSES.has(status)

/**
 * Whether a run of `trigger` that reached `status` drops its trigger data and
 * steps: a `minimal` or `none` trigger, and a run that ended.
 */
export const dropsRunHistory = (
  trigger: { readonly history?: TriggerHistory } | undefined,
  status: string
): boolean => keepsMinimalHistory(trigger) && hasRunEnded(status)
