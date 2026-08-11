/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What to tell someone after they pressed a `type: 'button'` field, and whether
 * the record they are looking at may have moved underneath them.
 *
 * The split that matters is between a run that was REFUSED and a run that
 * BROKE. The invoke endpoint answers 404 for every authorization denial
 * (anti-enumeration: a boundary must be indistinguishable from an absent
 * record), so "not for you" and "not there" arrive as the same status — and
 * neither is fixed by pressing again. Telling that reader "try again" sends
 * them into a loop; telling them "something broke" is simply untrue.
 *
 * A 404 therefore says the action is unavailable and stops. Only a genuine
 * fault — a 5xx, or a request that never completed — invites a retry.
 */

/** A denial or an absent record; the same message covers both, as the API does. */
const UNAVAILABLE = 'This action is not available on this record.'

/** The run started and the engine reported it did not finish cleanly. */
const UNFINISHED = 'The action ran but did not complete.'

/** The request never produced a usable answer. The one case worth retrying. */
const UNREACHABLE = 'The action could not be run. Try again.'

const COMPLETED = 'Action completed.'

export interface ButtonOutcome {
  readonly message: string
  readonly variant: 'success' | 'error'
  /**
   * Whether the automation got far enough to have touched the record. Drives
   * the host surface's refresh, so it is true for a run that failed part-way
   * as well as one that succeeded — a half-applied write is still a write.
   */
  readonly changed: boolean
}

/** Every terminal run status that is not a clean completion. */
const INCOMPLETE_RUN_STATUSES: ReadonlySet<string> = new Set([
  'failed',
  'completed-with-errors',
  'cancelled',
])

/**
 * The outcome for a request that never reached a response — offline, aborted,
 * or a body that could not be read.
 */
export const BUTTON_REQUEST_FAILED: ButtonOutcome = {
  message: UNREACHABLE,
  variant: 'error',
  changed: false,
}

/**
 * Read the engine's run status out of the response body.
 *
 * A 200 does NOT mean the automation succeeded: the endpoint answers 200 with
 * `status: 'failed'` when the run itself errored, so treating `response.ok` as
 * success reports a failed run as a completed one. An unreadable body is read
 * as a clean completion — the run was accepted, and inventing a failure from a
 * parse problem would be a worse lie than the one being fixed.
 */
async function readRunStatus(response: Response): Promise<string> {
  const body = (await response.json().catch(() => undefined)) as
    { readonly status?: unknown } | undefined
  return typeof body?.status === 'string' ? body.status : 'completed'
}

/**
 * Classify what the invoke endpoint answered into something a reader can act
 * on.
 */
export async function classifyButtonResponse(response: Response): Promise<ButtonOutcome> {
  if (response.status === 404) {
    return { message: UNAVAILABLE, variant: 'error', changed: false }
  }
  if (!response.ok) return BUTTON_REQUEST_FAILED
  const runStatus = await readRunStatus(response)
  return INCOMPLETE_RUN_STATUSES.has(runStatus)
    ? { message: UNFINISHED, variant: 'error', changed: true }
    : { message: COMPLETED, variant: 'success', changed: true }
}
