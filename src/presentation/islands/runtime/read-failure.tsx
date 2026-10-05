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
 * The island QueryClient's two retries, withheld from a rate-limited read: it is
 * not worth asking again before its `Retry-After`, and asking at once only
 * spends the budget and holds the widget empty for the length of the backoff.
 * The widget offers its own Retry instead.
 */
export const retryUnlessRateLimited = (failureCount: number, error: Error): boolean =>
  !isRateLimitedRead(error) && failureCount < 2

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
