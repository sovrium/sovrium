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
 * earlier steps' outputs.
 */

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

/** Whether a trigger keeps only the run row of the runs it starts. */
export const keepsMinimalHistory = (
  trigger: { readonly history?: 'full' | 'minimal' } | undefined
): boolean => trigger?.history === 'minimal'

/**
 * Whether a run of `trigger` that reached `status` drops its trigger data and
 * steps: a `minimal` trigger, and a run that ended.
 */
export const dropsRunHistory = (
  trigger: { readonly history?: 'full' | 'minimal' } | undefined,
  status: string
): boolean => keepsMinimalHistory(trigger) && hasRunEnded(status)
