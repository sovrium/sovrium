/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The guards every `/api/*` request passes before rate limiting and auth:
 * a request timeout, a body-size cap, and the two per-IP sliding windows.
 *
 * They are applied as one block at the head of the API chain, so they live in
 * one module rather than three — the ORDER they are applied in is the contract,
 * and it is stated where they are applied, in `api-auth-guards.ts`.
 */

import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { timeout } from 'hono/timeout'
import {
  DEFAULT_STT_TIMEOUT_MS,
  MAX_TIMER_MS,
  parseSpeechEnv,
} from '@/domain/models/process-env/ai/speech'
import { parsePositiveIntEnv } from '@/domain/models/process-env/positive-int-env'
import { rateLimitedResponse } from '@/infrastructure/process/rate-limit-response'
import {
  getActivityRateLimitRetryAfter,
  getTablesRateLimitRetryAfter,
  isActivityRateLimitExceeded,
  isTablesRateLimitExceeded,
  recordActivityRateLimitRequest,
  recordTablesRateLimitRequest,
} from '@/presentation/api/auth/auth-route-utils'
import { getRequestClientIp } from '@/presentation/api/middleware/client-ip'
import type { Hono } from 'hono'

/**
 * Whether a `/api/tables/*` path is the realtime subscription endpoint.
 *
 * `GET /api/tables/:tableId/subscribe` (and the `/subscribe/sse` alias) is a
 * long-lived Server-Sent-Events / WebSocket subscription, NOT a CRUD record
 * read. It must be exempt from the records rate limiter: the browser
 * `EventSource` reconnects every time the bounded-lifetime stream closes, and
 * counting each reconnect against the 100-req/60s `GET:/api/tables/*` budget
 * starves the page's own record reads — and, once the budget is exhausted, a
 * 429 to `EventSource` triggers an immediate reconnect, producing a
 * rate-limit feedback storm. A subscription endpoint is self-limiting (one
 * long connection), so skipping the burst limiter is correct.
 */
const isRealtimeSubscriptionPath = (path: string): boolean =>
  /^\/api\/tables\/[^/]+\/subscribe(\/sse)?$/.test(path)

/**
 * Apply rate limiting middleware for table API endpoints
 * Returns a Hono app with rate limiting middleware applied
 */

export const applyTablesRateLimitMiddleware = (honoApp: Hono): Hono => {
  return honoApp
    .use('/api/tables', async (c, next) => {
      const ip = getRequestClientIp(c)
      const { method } = c.req
      const path = '/api/tables'

      if (isTablesRateLimitExceeded(method, path, ip)) {
        const retryAfter = getTablesRateLimitRetryAfter(method, path, ip)
        return rateLimitedResponse(c, retryAfter)
      }

      recordTablesRateLimitRequest(method, path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      await next()
    })
    .use('/api/tables/*', async (c, next) => {
      const ip = getRequestClientIp(c)
      const { method } = c.req
      const { path } = c.req

      // The realtime subscription endpoint is a long-lived stream, not a CRUD
      // read — exempt it from the records burst limiter (see helper doc).
      if (isRealtimeSubscriptionPath(path)) {
        await next()
        return
      }

      if (isTablesRateLimitExceeded(method, path, ip)) {
        const retryAfter = getTablesRateLimitRetryAfter(method, path, ip)
        return rateLimitedResponse(c, retryAfter)
      }

      recordTablesRateLimitRequest(method, path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      await next()
    })
}

/**
 * Apply rate limiting middleware for activity API endpoints
 * Returns a Hono app with rate limiting middleware applied
 */

export const applyActivityRateLimitMiddleware = (honoApp: Hono): Hono => {
  return honoApp
    .use('/api/activity', async (c, next) => {
      const ip = getRequestClientIp(c)
      const { method } = c.req
      const path = '/api/activity'

      if (isActivityRateLimitExceeded(method, path, ip)) {
        const retryAfter = getActivityRateLimitRetryAfter(method, path, ip)
        return rateLimitedResponse(c, retryAfter)
      }

      recordActivityRateLimitRequest(method, path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      await next()
    })
    .use('/api/activity/*', async (c, next) => {
      const ip = getRequestClientIp(c)
      const { method } = c.req
      const { path } = c.req

      if (isActivityRateLimitExceeded(method, path, ip)) {
        const retryAfter = getActivityRateLimitRetryAfter(method, path, ip)
        return rateLimitedResponse(c, retryAfter)
      }

      recordActivityRateLimitRequest(method, path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      await next()
    })
}

/**
 * The deadline one route prefix runs under instead of `API_TIMEOUT_MS`.
 *
 * `undefined` exempts the route: `/api/ai/chat/stream` and the presence channel are
 * long-lived Server-Sent-Events responses a `hono/timeout` would abort
 * mid-flight. A number is the route's own ceiling, derived from the general one.
 * The first prefix a path starts with wins; a path matching none gets
 * `API_TIMEOUT_MS`. Any future streaming or long-running endpoint belongs here.
 */
interface RouteTimeout {
  readonly prefix: string
  readonly ceilingMs: (apiTimeoutMs: number) => number | undefined
}

/**
 * The speech engine's own deadline (`STT_TIMEOUT_MS`), read through the same
 * parser the speech service uses so the two can never disagree. An unset or
 * invalid speech configuration falls back to the default deadline; the route
 * answers 503 or refuses the boot in those cases anyway.
 */
const speechTimeoutMs = (): number => {
  const parsed = parseSpeechEnv(process.env)
  return parsed.ok && parsed.config !== undefined ? parsed.config.timeoutMs : DEFAULT_STT_TIMEOUT_MS
}

/**
 * A `hono/timeout` that answers 504 with a fresh exception per request (see
 * below). Capped at what a timer can hold: past it the runtime fires the timer
 * after 1 ms, which would turn a generous deadline into none at all.
 */
const gatewayTimeout = (ms: number) =>
  timeout(Math.min(ms, MAX_TIMER_MS), () => new HTTPException(504, { message: 'Gateway Timeout' }))

const ROUTE_TIMEOUTS: readonly RouteTimeout[] = [
  { prefix: '/api/ai/chat/stream', ceilingMs: () => undefined },
  { prefix: '/api/realtime/presence', ceilingMs: () => undefined },
  // A transcription is bounded by the speech engine, not by the ceiling every
  // other call gets: an accurate pass over a long recording legitimately takes
  // minutes. The engine's deadline plus the general one leaves room for the
  // upload before the engine is even contacted, so it is always the speech
  // service's own timeout — answered 504 by the route — that fires first.
  {
    prefix: '/api/ai/transcriptions',
    ceilingMs: (apiTimeoutMs) => speechTimeoutMs() + apiTimeoutMs,
  },
]

/**
 * Apply a global request timeout to `/api/*` and a body-size guard to the
 * record-mutation route group.
 *
 * - **Timeout** (`hono/timeout`): default 30 s, override via `API_TIMEOUT_MS`.
 *   A route listed in `ROUTE_TIMEOUTS` runs under its own ceiling instead, or
 *   none at all for a streaming response.
 * - **Body limit** (`hono/body-limit`): default 25 MB, override via
 *   `API_BODY_LIMIT_BYTES`. Mounted on the record-mutation route group
 *   (`/api/tables/*`) only — these carry JSON record payloads.
 *
 *   File-upload route groups (`/api/buckets/*`, `/api/forms/*`) are
 *   **deliberately excluded**: the buckets subsystem enforces its own
 *   streaming-aware size limit (per-bucket `maxFileSize` → `STORAGE_MAX_FILE_SIZE`
 *   env → 100 MB default, returning HTTP 413), and the streaming upload server
 *   is designed to accept large files (>50 MB). A blanket Hono `body-limit`
 *   there would override that contract and reject legitimate large uploads.
 *
 * Mounted before auth/rate-limiting so oversized or slow requests are
 * rejected as early as possible.
 */

export const applyRequestGuards = (honoApp: Hono): Hono => {
  const timeoutMs = parsePositiveIntEnv(process.env['API_TIMEOUT_MS']) ?? 30_000
  const bodyLimitBytes =
    parsePositiveIntEnv(process.env['API_BODY_LIMIT_BYTES']) ?? 25 * 1024 * 1024

  // Every timeout is built by `gatewayTimeout`, a FACTORY rather than
  // `timeout(timeoutMs)`'s default exception. That default is a
  // module-level singleton `hono/timeout` constructs once at import time, which
  // broke error reporting twice over: its `.stack` is frozen to the CLI's boot
  // import graph (so a timeout report named `cli/index.ts`, a frame with nothing
  // to do with the failed request — in the compiled binary it resolved to the
  // HELP_TEXT line), and its object identity is shared by every timeout for the
  // process lifetime (so the reporter's identity guard muted all but the first).
  // Building a fresh exception per timeout gives each one a request-scoped stack
  // and a distinct identity.
  const defaultTimeout = gatewayTimeout(timeoutMs)
  const routeTimeouts = ROUTE_TIMEOUTS.map(({ prefix, ceilingMs }) => {
    const ceiling = ceilingMs(timeoutMs)
    return { prefix, middleware: ceiling === undefined ? undefined : gatewayTimeout(ceiling) }
  })

  return honoApp
    .use('/api/*', async (c, next) => {
      const route = routeTimeouts.find(({ prefix }) => c.req.path.startsWith(prefix))
      if (route === undefined) return defaultTimeout(c, next)
      return route.middleware === undefined ? next() : route.middleware(c, next)
    })
    .use('/api/tables/*', bodyLimit({ maxSize: bodyLimitBytes }))
}
