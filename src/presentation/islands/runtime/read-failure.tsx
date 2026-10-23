/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-refresh/only-export-components -- the 429 rule and the
   notice share one module on purpose: every module boundary an island adds is
   a row in the eager island entry's chunk graph (see the module doc). */
import type { ReactElement } from 'react'

/**
 * How a records read refused with 429 is told apart from a fault, and what a
 * KPI, a list or a table shows then. (`use-records-query` keeps its own copy of
 * the status rule, so the islands that page through it do not pay for the
 * notice.)
 *
 * The status travels on the thrown error's `cause`, so a widget branches on the
 * number, never on the wording of a response body. The notice lives beside the
 * rule, in one module, because every island that reads it pays for each module
 * boundary in the eager island entry.
 */

/** The HTTP status a failed read carried, when it got a response. */
const statusOf = (error: unknown): unknown =>
  error instanceof Error
    ? (error.cause as { readonly status?: unknown } | undefined)?.status
    : undefined

/** Whether a records query was refused because its caller's read budget is spent (429). */
export const isRateLimitedRead = (error: unknown): boolean => statusOf(error) === 429

/**
 * Whether a read was refused because the caller's session has ended (401).
 * Asking again cannot succeed until the reader signs in, so it is not retried
 * either, and a console answers it by leaving for its sign-in page.
 */
export const isSessionEndedRead = (error: unknown): boolean => statusOf(error) === 401

/**
 * Whether a read was answered 404: the reader may not read it, or it is gone.
 * Asking again cannot change that answer, so no Retry is offered for it.
 */
export const isNotFoundRead = (error: unknown): boolean => statusOf(error) === 404

/**
 * Whether a read was refused as malformed (400): the reader's own search,
 * filter or sort. The same request is refused again, so no Retry is offered.
 */
export const isMalformedRead = (error: unknown): boolean => statusOf(error) === 400

/**
 * The island QueryClient's two retries, kept for a FAULT and withheld from an
 * ANSWER. A read the server refused with a 4xx — a sort key it does not
 * accept (400), a session that ended (401), a reader it does not serve (404),
 * a spent budget (429) — returns the same refusal however often it is asked,
 * so retrying it only holds the widget in its optimistic state for the length
 * of the backoff: a header claiming a sort the server already refused, with
 * nothing on screen saying so. A 5xx or a dropped connection may pass, and is
 * asked again. The widget offers its own Retry either way.
 */
export const retryFaultsOnly = (failureCount: number, error: Error): boolean => {
  const status = statusOf(error)
  const answered = typeof status === 'number' && status >= 400 && status < 500
  return !answered && failureCount < 2
}

/**
 * The notice's English words. The page-language text comes from the server
 * catalogue (`rateLimit.message`, `rateLimit.retry`) through the host island's
 * resolved strings; these are what an English page, or a host that sent none,
 * reads.
 */
const RATE_LIMITED_MESSAGE = 'Too many requests. Wait a moment, then retry.'
const RATE_LIMITED_RETRY = 'Retry'

/**
 * What a KPI, a list or a table shows when its records read was refused with
 * 429: a sentence a reader understands and a Retry that asks again — never the
 * raw response body, and never "refresh the page", which would re-spend the
 * budget of every widget on it.
 */
export function RateLimitedNotice({
  onRetry,
  strings,
}: {
  /** Ask for the data again. */
  readonly onRetry: () => void
  /** The host island's server-resolved strings, when they differ from English. */
  readonly strings?: Readonly<Record<string, string>> | undefined
}): ReactElement {
  return (
    <div
      role="alert"
      className="border-warning-border bg-warning-bg text-warning-fg rounded border p-3"
    >
      <p>{strings?.['rateLimit.message'] ?? RATE_LIMITED_MESSAGE}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 font-medium underline"
      >
        {strings?.['rateLimit.retry'] ?? RATE_LIMITED_RETRY}
      </button>
    </div>
  )
}
