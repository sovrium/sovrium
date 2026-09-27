/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which failed attempts are worth another try, and how long to wait first.
 *
 * A retry spends time and a request; it is worth it only for a failure that a
 * second attempt could plausibly turn into a success. Pure functions over a
 * failed {@link ActionOutcome}, so the retry loop reads as policy.
 */

import type { ActionOutcome } from '../action-handlers/shared'

/**
 * Longest `Retry-After` the retry loop will honour. A server asking for more
 * than this is not retried at all: holding a run open for minutes is worse
 * than failing it, and retrying sooner than asked is what `Retry-After` forbids.
 */
export const MAX_RETRY_AFTER_MS = 30_000

/** The HTTP status and headers of a failed `http` action, when it got a response. */
const responseOf = (
  outcome: ActionOutcome
): { readonly status: number; readonly headers: Readonly<Record<string, string>> } | undefined => {
  const response = outcome.output?.['response']
  if (response === null || typeof response !== 'object') return undefined
  const { status, headers } = response as { readonly status?: unknown; readonly headers?: unknown }
  if (typeof status !== 'number') return undefined
  const headerMap =
    headers !== null && typeof headers === 'object'
      ? (headers as Readonly<Record<string, string>>)
      : {}
  return { status, headers: headerMap }
}

/**
 * True when a failed attempt is TRANSIENT — worth retrying.
 *
 * A failure with no HTTP response (a network error, a timeout, any action that
 * is not an HTTP call) keeps retrying as before. An HTTP failure is transient
 * for `408`, `429` and every `5xx`; any other `4xx` — a missing record, a
 * refused credential, a malformed request — fails the same way on every try,
 * so it is not retried.
 */
export const isTransientFailure = (outcome: ActionOutcome): boolean => {
  const response = responseOf(outcome)
  if (response === undefined) return true
  const { status } = response
  return status === 408 || status === 429 || status >= 500
}

/**
 * Milliseconds a `Retry-After` value asks the client to wait: delta-seconds
 * (`120`) or an HTTP-date. `undefined` when absent or unreadable. Pure given
 * `now`.
 */
export const parseRetryAfterMs = (value: string | undefined, now: number): number | undefined => {
  if (value === undefined || value.trim() === '') return undefined
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000
  const date = Date.parse(trimmed)
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}

/**
 * How long a `429` or `503` response asked the client to wait before trying
 * again, from its `Retry-After` header; `undefined` for any other outcome.
 */
export const requestedRetryDelayMs = (outcome: ActionOutcome, now: number): number | undefined => {
  const response = responseOf(outcome)
  if (response === undefined || (response.status !== 429 && response.status !== 503)) {
    return undefined
  }
  const header = Object.entries(response.headers).find(
    ([name]) => name.toLowerCase() === 'retry-after'
  )?.[1]
  return parseRetryAfterMs(header, now)
}
