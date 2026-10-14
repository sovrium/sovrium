/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one `HttpClient` the server provides to code that egresses over Effect's
 * HTTP stack ([internal ref] D5).
 *
 * Standing rule E6 says every egress has a timeout that ABORTS. Over `fetch`
 * that is `withFetchTimeout`, because interrupting a fiber cannot cancel a
 * promise. Over `HttpClient` the asymmetry inverts: `HttpClient.make` owns an
 * `AbortController` per request and aborts it when the request fiber is
 * interrupted, so a deadline applied with `Effect.timeoutOrElse` closes the
 * socket. This module is the only place a fetch-backed client is built — the
 * ESLint rule `sovrium/no-unbounded-http-client` refuses `FetchHttpClient`
 * anywhere else — and it adds, to every request:
 *
 *  - a deadline for the RESPONSE HEADERS, failing with a typed timeout rather
 *    than hanging. A body the caller reads afterwards (a stream, a large JSON
 *    reply) is the caller's to bound: a streamed body gets an idle deadline
 *    with `Stream.timeoutOrElse` into a failing stream — never `Stream.timeout`,
 *    which ends a stream silently so a truncated reply reads as a whole one;
 *  - `retryTransient` on `egressRetrySchedule()` for a request that may be
 *    retried. The retry wraps the headers phase only, so a streamed request is
 *    never retried after its first byte; a caller that must not be retried at
 *    all (a streamed generation, an MCP `tools/call`) says so per request;
 *  - `redirect: 'manual'` by default, the same default as `withFetchTimeout`. A
 *    configured AI endpoint may follow redirects, as it does over `fetch`.
 *
 * It bounds TIME, not destination: a URL a user or an operator wrote still goes
 * through `validateOutboundUrl` before it reaches a client.
 *
 * Per-request policy travels in {@link EgressPolicy}, a fiber reference the
 * caller scopes around its own requests (`Effect.provideService`). The client
 * reads it when each request starts, so a provider package that builds its
 * requests inside `node_modules` is bounded without knowing it.
 */

import { Context, Data, Duration, Effect, Layer } from 'effect'
import { FetchHttpClient, HttpClient, HttpClientError } from 'effect/http'
import { egressRetrySchedule } from './egress-retry'
import type { HttpClientRequest, HttpClientResponse } from 'effect/http'

/**
 * Deadline applied to a request whose caller names none of its own.
 *
 * Two minutes is set against the worst realistic case of the slowest caller —
 * a large model producing a long answer, which a non-streaming provider buffers
 * until it is done — rather than the typical one, so the default never cuts off
 * a call that would otherwise have succeeded.
 */
export const DEFAULT_CHAT_REQUEST_TIMEOUT_MS = 120_000

/**
 * Time-to-headers deadline for a STREAMED request.
 *
 * A stream must not carry a whole-request deadline — it would cut a long
 * answer off mid-generation. What this bounds is the failure that actually
 * happens: an endpoint that accepts the connection and never starts answering.
 */
export const STREAM_HEADERS_TIMEOUT_MS = 60_000

/** What one request may do, read when the request starts. */
export interface EgressRequestPolicy {
  /** Deadline for the response headers, in ms. Unset: the layer's default. */
  readonly timeoutMs?: number
  /** Whether a transient failure (a 5xx, a 429, a reset socket) is retried. */
  readonly retry?: boolean
  /** The redirect policy. Unset: the layer's default (`'manual'`). */
  readonly redirect?: RequestRedirect
}

/**
 * The per-request policy, scoped by the caller around its requests.
 *
 * A `Context.Reference` rather than a required service: a request issued with
 * no policy in scope gets the layer's defaults, never a missing-service defect.
 */
export const EgressPolicy = Context.Reference<EgressRequestPolicy>('sovrium/egress/EgressPolicy', {
  defaultValue: () => ({}),
})

/**
 * The deadline elapsed before the response headers arrived.
 *
 * Carried as the `cause` of the `TransportError` the client fails with, so a
 * caller that reads `HttpClientError` directly can tell a timeout from a reset
 * socket; its message names the deadline for callers that only see text.
 */
export class EgressTimeoutError extends Data.TaggedError('EgressTimeoutError')<{
  readonly url: string
  readonly timeoutMs: number
}> {
  override get message(): string {
    return `egress timed out after ${String(this.timeoutMs)}ms waiting for ${this.url}`
  }
}

/** The text every timeout failure carries, so a caller seeing only a message can match it. */
export const EGRESS_TIMEOUT_MARKER = 'egress timed out'

/** Defaults of one bounded client; each request may narrow them through {@link EgressPolicy}. */
export interface BoundedHttpClientOptions {
  /** Deadline for the response headers, in ms. Default {@link DEFAULT_CHAT_REQUEST_TIMEOUT_MS}. */
  readonly requestTimeoutMs?: number
  /** Whether transient failures are retried. Default `true`. */
  readonly retry?: boolean
  /** The redirect policy. Default `'manual'`. */
  readonly redirect?: RequestRedirect
}

/** The policy a request runs under: its own, then the layer's, then the module defaults. */
export const resolveEgressPolicy = (
  request: EgressRequestPolicy,
  defaults: BoundedHttpClientOptions
): Required<EgressRequestPolicy> => ({
  timeoutMs: request.timeoutMs ?? defaults.requestTimeoutMs ?? DEFAULT_CHAT_REQUEST_TIMEOUT_MS,
  retry: request.retry ?? defaults.retry ?? true,
  redirect: request.redirect ?? defaults.redirect ?? 'manual',
})

const timeoutFailure = (
  request: HttpClientRequest.HttpClientRequest,
  timeoutMs: number
): HttpClientError.HttpClientError => {
  const cause = new EgressTimeoutError({ url: request.url, timeoutMs })
  return new HttpClientError.HttpClientError({
    reason: new HttpClientError.TransportError({ request, cause, description: cause.message }),
  })
}

/**
 * One request, bounded: the deadline wraps the headers phase, the retry wraps
 * the deadline (each attempt gets the whole deadline), and the redirect policy
 * is handed to `fetch` through `FetchHttpClient.RequestInit`.
 */
const boundRequest =
  (defaults: BoundedHttpClientOptions) =>
  <E, R>(
    effect: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>,
    request: HttpClientRequest.HttpClientRequest
  ): Effect.Effect<HttpClientResponse.HttpClientResponse, E | HttpClientError.HttpClientError, R> =>
    Effect.flatMap(Effect.service(EgressPolicy), (requested) => {
      const policy = resolveEgressPolicy(requested, defaults)
      const attempt = effect.pipe(
        Effect.provideService(FetchHttpClient.RequestInit, { redirect: policy.redirect }),
        Effect.timeoutOrElse({
          duration: Duration.millis(policy.timeoutMs),
          orElse: () => Effect.fail(timeoutFailure(request, policy.timeoutMs)),
        })
      )
      return policy.retry
        ? attempt.pipe(
            // A transient STATUS comes back as a response, not a failure (a
            // provider client only turns it into one with `filterStatusOk`,
            // outside this transform), so it is repeated rather than retried;
            // the last response is returned either way, for the caller to judge.
            Effect.repeat({
              schedule: egressRetrySchedule(),
              while: (response) => TRANSIENT_STATUSES.has(response.status),
            }),
            Effect.retry({
              schedule: egressRetrySchedule(),
              while: (error) =>
                HttpClientError.isHttpClientError(error) && isTransientTransport(error),
            })
          )
        : attempt
    })

/**
 * A transport failure worth another try: a reset socket or a refused
 * connection, never our own deadline, which already spent its whole budget.
 */
const isTransientTransport = (error: HttpClientError.HttpClientError): boolean =>
  error.reason._tag === 'TransportError' && !(error.reason.cause instanceof EgressTimeoutError)

const TRANSIENT_STATUSES: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504])

/**
 * The bounded fetch-backed `HttpClient`.
 *
 * A retried request is re-sent on a transient status (408, 429, 5xx) and on a
 * transient transport failure, up to the attempts `egressRetrySchedule()`
 * allows; the deadline applies to each attempt.
 */
export const boundedHttpClientLayer = (
  options: BoundedHttpClientOptions = {}
): Layer.Layer<HttpClient.HttpClient> =>
  Layer.effect(
    HttpClient.HttpClient,
    Effect.map(Effect.service(HttpClient.HttpClient), (client) =>
      HttpClient.transform(client, boundRequest(options))
    )
  ).pipe(Layer.provide(FetchHttpClient.layer))
