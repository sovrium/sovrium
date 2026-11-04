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
 * steps. While the run is under way its row keeps the trigger data without the
 * request body: the running code reads the body from memory. While the run is
 * paused (an approval, a confirmation, a long delay) the row keeps the body
 * too, since a resume after a restart reads it from there, and the earlier
 * steps' outputs. A trigger declaring `history: 'none'` keeps the same
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

/** The run statuses of a run waiting to be resumed: an approval or a confirmation, a long delay. */
const PAUSED_RUN_STATUSES: ReadonlySet<string> = new Set(['waiting-approval', 'waiting-delay'])

/** Whether a run in this status waits to be resumed. */
export const isRunPaused = (status: string): boolean => PAUSED_RUN_STATUSES.has(status)

/**
 * Whether a run of `trigger` pausing in `status` stores its request body on its
 * row, for its resume to read: a `minimal` or `none` trigger, which keeps no
 * body while the run is under way. A `full` trigger's row kept it all along.
 */
export const storesBodyOnPause = (
  trigger: { readonly history?: TriggerHistory } | undefined,
  status: string
): boolean => keepsMinimalHistory(trigger) && isRunPaused(status)

/**
 * The payload keys a row of a `minimal` or `none` run keeps no copy of while
 * it is under way: the request `body`, and the `input` a run started by name
 * or from a page button reads, which is that same body, or a calling run's
 * payload.
 */
const PAYLOAD_KEYS: ReadonlySet<string> = new Set(['body', 'input'])

/**
 * `data` as the row of a run of `trigger` keeps it while the run is under way:
 * without its request `body` (nor the `input` copied from it) for a `minimal`
 * or `none` trigger, unchanged otherwise. Everything else (method, path,
 * headers, query, the record a run was started on) stays, so the row still
 * says what started the run.
 */
export const triggerDataUnderWay = <T>(
  trigger: { readonly history?: TriggerHistory } | undefined,
  data: T
): T => {
  if (!keepsMinimalHistory(trigger)) return data
  if (typeof data !== 'object' || data === null) return data
  if (!Object.keys(data).some((key) => PAYLOAD_KEYS.has(key))) return data
  return Object.fromEntries(Object.entries(data).filter(([key]) => !PAYLOAD_KEYS.has(key))) as T
}
