/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The single 429 response envelope.
 *
 * `{ success, message, code }` + a `Retry-After` header was written out by hand
 * at every throttled endpoint — four times in `route-setup/api-routes.ts`
 * (tables and activity, each with a bare and a wildcard route), once in
 * `route-setup/auth-routes.ts`, and once more in the realtime subscribe
 * handler. Specs assert on all three parts (`code`, a message containing "Too
 * many requests", and a positive integer `Retry-After`), so a copy that drifted
 * would break a contract rather than merely look untidy.
 *
 * This lives in `infrastructure/utils/` rather than beside its busiest caller
 * in `infrastructure/server/`, because the subscribe handler is a presentation
 * route: `presentation-api-route` may reach `infrastructure-utils` (pure
 * helpers with no I/O and no DI) but NOT `infrastructure-server`. See the
 * `boundaries` allowlist in `[internal ref]`.
 *
 * Two further copies survived that consolidation because they live in
 * `presentation/api/routes/` rather than in `route-setup/` — the shared-views
 * and command-search limiters — and were folded in later. Read the list above as
 * a record of the first pass, not as an inventory: the callers are whatever
 * `rg -l rateLimitedResponse src` reports today.
 *
 * The MCP limiter keeps its own builder (`route-setup/mcp/rate-limit.ts`): its
 * 429 carries a JSON-RPC `-32603` error object and `X-RateLimit-*` headers, not
 * this envelope.
 */

import type { Context, Env } from 'hono'

/** Body message shared by every rate-limit rejection. */
export const RATE_LIMITED_MESSAGE = 'Too many requests. Please try again later.'

/**
 * Machine-readable reason a 429 was returned.
 *
 * `RATE_LIMITED` is a request-rate ceiling over a sliding window;
 * `TOO_MANY_CONNECTIONS` is a concurrent-connection cap, which is a different
 * condition — the caller is not sending too fast, it is holding too many open
 * streams — and the realtime subscribe handler reports it with its own message
 * and a fixed retry hint.
 */
export type RateLimitCode = 'RATE_LIMITED' | 'TOO_MANY_CONNECTIONS'

interface TooManyRequestsInput {
  readonly message: string
  readonly code: RateLimitCode
  /**
   * Whole seconds, emitted verbatim as the `Retry-After` header value.
   *
   * Optional because one caller legitimately has no hint to give: the admin
   * limiter in `auth-routes.ts` has always answered without the header. Adding
   * one there would be a behaviour change rather than a refactor, so the
   * envelope accommodates its absence instead of quietly inventing a value.
   */
  readonly retryAfterSeconds?: number
}

/**
 * Build a 429 in the shared envelope with an explicit message and code.
 *
 * Generic over Hono's `Env` and path because the callers are middleware bound
 * to a specific route (`Context<BlankEnv, '/api/tables'>`), which is not
 * assignable to the `Context` default. Only `c.json` is used.
 */
export const tooManyRequestsResponse = <E extends Env, P extends string>(
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
  c: Context<E, P>,
  input: Readonly<TooManyRequestsInput>
): Response =>
  c.json(
    {
      success: false,
      message: input.message,
      code: input.code,
    },
    429,
    input.retryAfterSeconds === undefined
      ? {}
      : { 'Retry-After': input.retryAfterSeconds.toString() }
  )

/**
 * Build the standard rate-limit 429 — the response every sliding-window
 * limiter in front of an HTTP route returns once a caller is over its ceiling.
 */
export const rateLimitedResponse = <E extends Env, P extends string>(
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
  c: Context<E, P>,
  retryAfterSeconds?: number
): Response =>
  tooManyRequestsResponse(c, {
    message: RATE_LIMITED_MESSAGE,
    code: 'RATE_LIMITED',
    retryAfterSeconds,
  })
