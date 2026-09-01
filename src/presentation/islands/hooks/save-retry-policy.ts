/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Retry policy for inline-edit saves, and the optimistic-locking token they
 * carry.
 *
 * Pure functions, deliberately separated from the hook that uses them: the
 * decisions here (how long to wait, what is worth retrying, which of two
 * timestamps is current) are the parts that can be wrong in a way no rendered
 * output would reveal, and they are the parts worth testing directly.
 */

/**
 * Retries attempted after the first failure, so a save makes at most
 * `MAX_SAVE_RETRIES + 1` requests before it gives up.
 *
 * Bounded rather than open-ended on purpose: an unbounded retry loop against a
 * server that is down is a client-side denial of service, and it strands the
 * edit with no signal that anything has stopped happening. When the budget is
 * spent the failure becomes a persistent error the user can act on.
 */
export const MAX_SAVE_RETRIES = 3

/** Delay before the first retry; each subsequent wait doubles it. */
const BASE_RETRY_DELAY_MS = 500

/**
 * Wait before the next attempt, given how many failures have already occurred.
 *
 * `failureCount` is 0 for the first retry — that is what TanStack Query passes,
 * because it reads the delay before incrementing its counter.
 *
 * The delay grows so that a server briefly under load is not hammered at a
 * fixed interval by every client that happens to be editing: 500ms, 1s, 2s.
 */
export function saveRetryDelayMs(failureCount: number): number {
  return BASE_RETRY_DELAY_MS * 2 ** Math.max(0, failureCount)
}

/** The HTTP status a failed save carries, when the failure came from a response. */
function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const { status } = error as { status?: unknown }
  return typeof status === 'number' ? status : undefined
}

/**
 * Whether a failed save is worth trying again unchanged.
 *
 * Only transient failures qualify: a dropped connection (no status at all) and
 * a server-side error. A 4xx is the server saying the request itself is
 * unacceptable — a validation failure, a permission refusal, a conflicting
 * write — and repeating it byte-for-byte cannot change the answer. Retrying a
 * 409 in particular would be actively wrong: the record moved on, so the
 * correct response is to tell the user, not to insist.
 */
export function isRetriableSaveError(error: unknown): boolean {
  const status = statusOf(error)
  return status === undefined || status >= 500
}

/** Whether the server refused this save because the record changed underneath it. */
export function isConflictError(error: unknown): boolean {
  return statusOf(error) === 409
}

/** TanStack Query `retry` predicate: a bounded budget spent only on transient failures. */
export function shouldRetrySave(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_SAVE_RETRIES && isRetriableSaveError(error)
}

export interface SaveFailure {
  readonly message: string
  /** The record moved on, so this save was declined rather than broken. */
  readonly isConflict: boolean
}

/**
 * Reduce a thrown save failure to what the UI has to decide between: the two
 * cases call for opposite affordances, so they must not collapse into one
 * "something went wrong".
 */
export function classifySaveFailure(error: unknown): SaveFailure {
  return {
    message: error instanceof Error ? error.message : 'Failed to save changes',
    isConflict: isConflictError(error),
  }
}

/**
 * Pick the more recent of two optimistic-locking tokens.
 *
 * A save must echo back the newest `updated_at` the client has seen, and it can
 * learn one from two places that race: the records query, and the response to
 * its own previous save. Taking the later of the two means a second edit to the
 * same row does not have to wait for a refetch to land before it can be
 * accepted — without it, back-to-back edits would conflict with themselves.
 *
 * Unparseable input loses to the alternative rather than poisoning the result.
 */
export function latestUpdatedAtToken(
  a: string | undefined,
  b: string | undefined
): string | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  const epochA = Date.parse(a)
  const epochB = Date.parse(b)
  if (Number.isNaN(epochA)) return b
  if (Number.isNaN(epochB)) return a
  return epochA >= epochB ? a : b
}
