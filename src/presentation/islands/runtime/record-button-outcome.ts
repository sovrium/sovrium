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

/** The button's `action.*` words in the page language, where they differ from English. */
export type ButtonStrings = Readonly<Record<string, string>> | undefined

/**
 * The four sentences, each the page's when the host sent it: a denial or an
 * absent record (one sentence for both, as the API does), a run that did not
 * finish cleanly, a request that never produced a usable answer (the one case
 * worth retrying), and a clean run.
 */
const say = (strings: ButtonStrings) => ({
  unavailable: strings?.['action.unavailable'] ?? 'This action is not available on this record.',
  unfinished: strings?.['action.unfinished'] ?? 'The action ran but did not complete.',
  unreachable: strings?.['action.unreachable'] ?? 'The action could not be run. Try again.',
  completed: strings?.['action.completed'] ?? 'Action completed.',
})

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
export const buttonRequestFailed = (strings: ButtonStrings): ButtonOutcome => ({
  message: say(strings).unreachable,
  variant: 'error',
  changed: false,
})

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
export async function classifyButtonResponse(
  response: Response,
  strings: ButtonStrings
): Promise<ButtonOutcome> {
  const words = say(strings)
  if (response.status === 404) {
    return { message: words.unavailable, variant: 'error', changed: false }
  }
  if (!response.ok) return buttonRequestFailed(strings)
  const runStatus = await readRunStatus(response)
  return INCOMPLETE_RUN_STATUSES.has(runStatus)
    ? { message: words.unfinished, variant: 'error', changed: true }
    : { message: words.completed, variant: 'success', changed: true }
}
