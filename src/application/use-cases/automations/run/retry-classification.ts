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
import type { SpeechError } from '@/application/ports/services/speech-service'

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
 * Is a failed HTTP answer with this status worth another try? `408`, `429` and
 * every `5xx` are; any other `4xx` — a missing record, a refused credential, a
 * malformed request — fails the same way on every try.
 */
export const isTransientStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500

/**
 * True when a failed attempt is TRANSIENT — worth retrying.
 *
 * A handler that knows says so with `retryable` on the outcome, and that answer
 * wins: a provider it called refused the input, or the input was refused before
 * anything was sent. Otherwise a failure with no HTTP response (a network
 * error, a timeout, any action that is not an HTTP call) keeps retrying as
 * before, and an HTTP failure retries on {@link isTransientStatus}.
 */
export const isTransientFailure = (outcome: ActionOutcome): boolean => {
  if (outcome.retryable !== undefined) return outcome.retryable
  const response = responseOf(outcome)
  if (response === undefined) return true
  return isTransientStatus(response.status)
}

/**
 * Whether a speech-to-text failure is worth another try.
 *
 * The endpoint's own answer decides for a provider error ({@link
 * isTransientStatus}); a timeout is transient. A recording refused before it was
 * sent, or an endpoint that is not configured, fails the same way on every try.
 */
export const isTransientSpeechFailure = (error: Readonly<SpeechError>): boolean => {
  switch (error._tag) {
    case 'SpeechProviderError':
      return isTransientStatus(error.statusCode)
    case 'SpeechTimeoutError':
      return true
    case 'SpeechInputError':
    case 'SpeechNotConfiguredError':
      return false
  }
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
