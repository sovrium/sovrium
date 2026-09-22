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
 * Resolve a positive-integer env override, falling back to a default.
 */
const envInt = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Streaming route prefixes that MUST NOT be subject to the request timeout.
 *
 * `/api/ai/chat/stream` is a long-lived Server-Sent-Events response; a
 * `hono/timeout` middleware would abort the stream mid-flight. Any future
 * streaming endpoint must be added here.
 */
const STREAMING_PREFIXES = ['/api/ai/chat/stream', '/api/realtime/presence'] as const

/**
 * Apply a global request timeout to `/api/*` and a body-size guard to the
 * record-mutation route group.
 *
 * - **Timeout** (`hono/timeout`): default 30 s, override via `API_TIMEOUT_MS`.
 *   Skipped for streaming routes (see `STREAMING_PREFIXES`).
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
  const timeoutMs = envInt('API_TIMEOUT_MS', 30_000)
  const bodyLimitBytes = envInt('API_BODY_LIMIT_BYTES', 25 * 1024 * 1024)

  // A FACTORY, not `timeout(timeoutMs)`'s default exception. That default is a
  // module-level singleton `hono/timeout` constructs once at import time, which
  // broke error reporting twice over: its `.stack` is frozen to the CLI's boot
  // import graph (so a timeout report named `cli/index.ts`, a frame with nothing
  // to do with the failed request — in the compiled binary it resolved to the
  // HELP_TEXT line), and its object identity is shared by every timeout for the
  // process lifetime (so the reporter's identity guard muted all but the first).
  // Building a fresh exception per timeout gives each one a request-scoped stack
  // and a distinct identity.
  const timeoutMiddleware = timeout(
    timeoutMs,
    () => new HTTPException(504, { message: 'Gateway Timeout' })
  )

  return honoApp
    .use('/api/*', async (c, next) => {
      // Skip the timeout for long-lived SSE / streaming responses.
      if (STREAMING_PREFIXES.some((prefix) => c.req.path.startsWith(prefix))) {
        return next()
      }
      return timeoutMiddleware(c, next)
    })
    .use('/api/tables/*', bodyLimit({ maxSize: bodyLimitBytes }))
}
