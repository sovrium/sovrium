/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  classifyEgressFailure,
  type EgressFailureKind,
} from '@/infrastructure/egress/egress-failure'
import type { ActionOutcome } from './shared'

/**
 * How an `http/*` request failed, as the step output says it: `error: { code,
 * message }` beside `response` when an answer arrived. The step still fails;
 * the output is what lets a later step (after `continueOnError`) read why.
 *
 * `code` and `message` are the keys the `ai/*` actions already publish on
 * their own failure output, so one template reads either family.
 */
export type HttpFailureCode = EgressFailureKind | 'http' | 'blocked'

const failureOutput = (code: HttpFailureCode, message: string) => ({ error: { code, message } })

/**
 * Map an HTTP status code to a stable, low-cardinality error category that
 * downstream consumers (run-history, retry policies, refresh-token logic)
 * can pattern-match without re-parsing free-form messages.
 *
 * 401 is split from a generic 4xx because a token-refresh path needs to
 * distinguish "token expired / scopes insufficient / grant revoked" from
 * "the request itself was malformed". 403 stays separate because it
 * usually signals an authorization problem the user cannot self-resolve
 * by re-auth. 429 is called out so backoff schedulers can branch on it.
 *
 * The `bodyExcerpt` (first 200 chars of the response body, when readable)
 * is included to help operators distinguish the three 401 sub-cases
 * without making them part of the structured error category — IdPs vary
 * widely in what they put in the body, so we surface it instead of
 * trying to classify it.
 */
const classifyHttpError = (status: number, bodyExcerpt: string | undefined): string => {
  const suffix = bodyExcerpt !== undefined && bodyExcerpt !== '' ? ` — ${bodyExcerpt}` : ''
  if (status === 401) return `HTTP 401 unauthorized${suffix}`
  if (status === 403) return `HTTP 403 forbidden${suffix}`
  if (status === 404) return `HTTP 404 not_found${suffix}`
  if (status === 408) return `HTTP 408 request_timeout${suffix}`
  if (status === 429) return `HTTP 429 rate_limited${suffix}`
  if (status >= 500) return `HTTP ${String(status)} upstream_error${suffix}`
  if (status >= 400) return `HTTP ${String(status)} client_error${suffix}`
  return `HTTP ${String(status)}${suffix}`
}

/** An answer outside 2xx: the step fails with the answer kept beside `error.code: 'http'`. */
export const httpStatusFailure = (
  status: number,
  body: string,
  output: Readonly<Record<string, unknown>>
): ActionOutcome => {
  const error = classifyHttpError(status, body.slice(0, 200))
  return { status: 'failure', error, output: { ...output, ...failureOutput('http', error) } }
}

/**
 * The outbound guard refused the url or a redirect hop: nothing was sent, and
 * sending it again would be refused again, so no retry policy retries it.
 */
export const blockedRequestFailure = (message: string): ActionOutcome => ({
  status: 'failure',
  error: message,
  output: failureOutput('blocked', message),
  retryable: false,
})

/**
 * The request was sent and got no answer: classified from the rejection. A
 * certificate the request does not trust fails the same way on every try, so
 * a `tls` failure is not retried; the others keep retrying as before.
 */
export const requestFailure = (rejection: unknown): ActionOutcome => {
  const message = rejection instanceof Error ? rejection.message : String(rejection)
  const code = classifyEgressFailure(rejection)
  return {
    status: 'failure',
    error: message,
    output: failureOutput(code, message),
    ...(code === 'tls' ? { retryable: false } : {}),
  }
}
