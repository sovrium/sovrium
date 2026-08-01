/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const UNAVAILABLE = 'This action is not available on this record.'

const UNFINISHED = 'The action ran but did not complete.'

const UNREACHABLE = 'The action could not be run. Try again.'

const COMPLETED = 'Action completed.'

export interface ButtonOutcome {
  readonly message: string
  readonly variant: 'success' | 'error'
  readonly changed: boolean
}

const INCOMPLETE_RUN_STATUSES: ReadonlySet<string> = new Set([
  'failed',
  'completed-with-errors',
  'cancelled',
])

export const BUTTON_REQUEST_FAILED: ButtonOutcome = {
  message: UNREACHABLE,
  variant: 'error',
  changed: false,
}

async function readRunStatus(response: Response): Promise<string> {
  const body = (await response.json().catch(() => undefined)) as
    { readonly status?: unknown } | undefined
  return typeof body?.status === 'string' ? body.status : 'completed'
}

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
