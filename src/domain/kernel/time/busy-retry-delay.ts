/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How long a client waits before asking a busy server again.
 *
 * A `429 Too Many Requests` or a `503 Service Unavailable` says « not now »,
 * never « no ». The wait is what the server asks in `Retry-After` — a number of
 * seconds, or an HTTP date — and is never shortened; without that header it is
 * 2 seconds, doubled after each refusal in a row, at most 30. It is never less
 * than {@link BUSY_RETRY_FLOOR_MS}, gets up to a quarter more at random so
 * clients refused together do not ask again together, and never runs past the
 * caller's deadline.
 */

/** The answers that mean « busy, ask again later ». */
export const BUSY_STATUSES: readonly number[] = [429, 503]

/** The shortest wait, whatever the server asks. */
export const BUSY_RETRY_FLOOR_MS = 2000

/** The longest wait the doubling reaches without a `Retry-After`. */
export const BUSY_RETRY_CEILING_MS = 30_000

/** The share of the wait added at most, at random. */
const JITTER_SHARE = 0.25

/** Whether an HTTP status says the server is busy rather than refusing. */
export const isBusyStatus = (status: number): boolean => BUSY_STATUSES.includes(status)

/**
 * The wait a `Retry-After` value asks for, in milliseconds from `now`: a
 * whole number of seconds, or an HTTP date. `undefined` when the header is
 * absent or reads as neither; a date already past asks for no wait.
 */
export const parseRetryAfterMs = (header: string | undefined, now: number): number | undefined => {
  const value = header?.trim()
  if (value === undefined || value === '') return undefined
  if (/^\d+$/.test(value)) return Number(value) * 1000
  // An HTTP date names its day and month; a bare number like `-3` is not one.
  const date = /[a-z]/i.test(value) ? Date.parse(value) : Number.NaN
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}

/** The wait without a `Retry-After`: 2 s for the first refusal in a row, doubled, at most 30 s. */
export const backoffMs = (streak: number): number =>
  Math.min(BUSY_RETRY_CEILING_MS, BUSY_RETRY_FLOOR_MS * 2 ** Math.max(0, streak - 1))

/** What one wait is computed from. */
export interface BusyRetryInput {
  /** The `Retry-After` header of the refusal, as sent. */
  readonly retryAfter: string | undefined
  /** The refusals in a row, this one included (1 for the first). */
  readonly streak: number
  readonly now: number
  /** The instant the caller stops waiting. */
  readonly deadline: number
  /** A number in `[0, 1)`; `Math.random` at the edge, fixed in a test. */
  readonly random: () => number
}

/** Milliseconds to wait before asking again; `0` once the deadline is reached. */
export const busyRetryDelayMs = (input: BusyRetryInput): number => {
  const asked = parseRetryAfterMs(input.retryAfter, input.now) ?? backoffMs(input.streak)
  const base = Math.max(BUSY_RETRY_FLOOR_MS, asked)
  const jitter = Math.min(1, Math.max(0, input.random())) * JITTER_SHARE * base
  return Math.max(0, Math.min(Math.round(base + jitter), input.deadline - input.now))
}
