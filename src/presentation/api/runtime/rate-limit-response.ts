/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The single 429 response envelope.
 *
 * `{ success, message, code }` + a `Retry-After` header was once written out by
 * hand at every throttled endpoint — the table and activity routes, the auth
 * routes, the realtime subscribe handler and the command-search limiter among
 * them. Specs assert on all three parts (`code`, a message containing "Too many
 * requests", and a positive integer `Retry-After`), so a copy that drifted
 * would break a contract rather than merely look untidy.
 *
 * It lives in `api/runtime/` because it is a Hono response helper shared by
 * route files of several slugs (`agents`, `ai`, `auth`, `search`, `tables`) and
 * by the `middleware/` guards, and a helper two or more slugs share belongs in
 * this tier. It needs nothing but Hono's `Context` type.
 *
 * The callers are whatever `rg -l rateLimitedResponse src` reports today; do
 * not read an inventory into this comment.
 *
 * The MCP limiter keeps its own builder (`api/mcp/rate-limit.ts`): its 429
 * carries a JSON-RPC `-32603` error object and `X-RateLimit-*` headers, not
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
 * and a fixed retry hint. `TOO_MANY_CODE_ATTEMPTS` is the lock on emailed
 * sign-in codes: too many codes were tried for one address, so the address
 * itself waits, whichever client asks next.
 */
export type RateLimitCode = 'RATE_LIMITED' | 'TOO_MANY_CONNECTIONS' | 'TOO_MANY_CODE_ATTEMPTS'

interface TooManyRequestsInput {
  readonly message: string
  readonly code: RateLimitCode
  /**
   * Whole seconds, emitted verbatim as the `Retry-After` header value.
   *
   * Optional so a caller with no meaningful hint omits the header rather than
   * inventing a value.
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
  c: Context<E, P>,
  retryAfterSeconds?: number
): Response =>
  tooManyRequestsResponse(c, {
    message: RATE_LIMITED_MESSAGE,
    code: 'RATE_LIMITED',
    retryAfterSeconds,
  })
