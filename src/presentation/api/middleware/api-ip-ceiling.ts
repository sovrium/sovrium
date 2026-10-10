/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The per-address API ceiling: one sliding window per client address, ahead of
 * every session lookup.
 *
 * Every authenticated route extracts the caller's session before it runs, and
 * that extraction is a database lookup (the session cookie, or an API key).
 * Only the records and activity routes had a limit in front of it, so one
 * address could drive unbounded lookups through any other route. This window
 * bounds them all at once.
 *
 * It is deliberately generous — `API_IP_RATE_LIMIT` per
 * `RATE_LIMIT_WINDOW_SECONDS`, default 1200 — so every per-route limit keeps
 * refusing first and a signed-in member's own records budget stays hers. It
 * cannot tell two people behind one address apart (it runs before the session
 * is known), which is why the operator can raise it.
 *
 * Keyed by {@link getRequestRateLimitKey} (an IPv6 client by its /64), so
 * `TRUSTED_PROXY_HOPS` decides which forwarding header is believed, exactly as
 * for sign-in: with no trusted proxy, a forged `X-Forwarded-For` buys no fresh
 * budget.
 *
 * The same budget covers the MCP endpoint wherever `MCP_MOUNT_PATH` mounts it
 * (its API-key path is the same lookup, its OAuth path an introspection call),
 * and page, `.md` twin and console requests that carry a credential — the
 * ones that make the page look a session up. A request is counted ONCE however
 * many of these mounts it passes (an MCP mount under `/api/` passes two).
 *
 * The limiter is built per server rather than at module level:
 * `serverMode: 'inprocess'` boots many servers in one process, and a
 * module-level window would let one boot's traffic count against the next.
 * Every mount on one server shares one instance, found through the server's
 * own Hono app (every chained `.use`/`.get` returns that same app).
 *
 * Memory: the key is attacker-chosen within the address space a caller can
 * reach. The limiter sweeps out addresses with no request left in the window
 * on its own, at most once per window, so the map never holds more than the
 * addresses seen in the last two windows (see `createSlidingWindowLimiter`).
 */

import {
  declaresTelemetryProtocol,
  isSentryEnvelopePath,
} from '@/domain/models/app/automations/trigger/webhook-telemetry-service'
import { resolveApiIpRateLimit } from '@/domain/models/process-env/api-ip-rate-limit'
import { isIngestRequest, markIngestRequest } from '@/infrastructure/logging/ingest-request-scope'
import { rateLimitedResponse } from '@/infrastructure/process/rate-limit-response'
import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'
import { getRateLimitWindowMs } from '@/presentation/api/auth/auth-route-utils'
import { getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { carriesCredential } from '@/presentation/api/middleware/request-credential'
import type { App } from '@/domain/models/app'
import type { Context, Hono, MiddlewareHandler, Next } from 'hono'

/**
 * Requests the ceiling has already counted. Keyed by the raw `Request`, which
 * lives exactly as long as the request, so nothing needs clearing.
 */
const counted = new WeakSet<Request>()

/**
 * A fresh ceiling middleware with its own window state. A refused request is
 * NOT recorded, so sustained traffic does not keep pushing the window forward.
 * A request that already passed it (through another mount) passes straight on.
 */
export const createApiIpCeilingMiddleware = (): MiddlewareHandler => {
  const limiter = createSlidingWindowLimiter()
  return async (c: Context, next: Next) => {
    if (counted.has(c.req.raw) || isIngestRequest(c.req.raw)) {
      await next()
      return
    }
    counted.add(c.req.raw)
    const { limited, retryAfter } = limiter.consume(getRequestRateLimitKey(c), {
      windowMs: getRateLimitWindowMs(),
      maxRequests: resolveApiIpRateLimit(),
    })
    if (limited) return rateLimitedResponse(c, retryAfter)
    await next()
  }
}

const ceilings = new WeakMap<object, MiddlewareHandler>()

/** The ONE ceiling of the server `hono` belongs to, created on first use. */
const ceilingOf = (hono: Readonly<Hono>): MiddlewareHandler => {
  const existing = ceilings.get(hono)
  if (existing !== undefined) return existing
  const created = createApiIpCeilingMiddleware()
  ceilings.set(hono, created)
  return created
}

/** The first segment of every `/api/<segment>/…` path a route or guard is registered under. */
const ENGINE_SEGMENT = /^\/api\/([^/:*]+)\//

const engineSegments = new WeakMap<object, ReadonlySet<string>>()

/**
 * The `/api/` namespaces the server's own routes claim (`auth`, `tables`, …),
 * read from its route table on the first request, once every route is
 * registered. A `POST /api/auth/envelope` is Better Auth's to answer, not the
 * telemetry route's, and must stay under the ceiling like any auth request.
 */
const engineSegmentsOf = (hono: Readonly<Hono>): ReadonlySet<string> => {
  const existing = engineSegments.get(hono)
  if (existing !== undefined) return existing
  const segments = new Set(
    hono.routes.flatMap((route) => {
      const segment = ENGINE_SEGMENT.exec(route.path)?.[1]
      return segment === undefined ? [] : [segment]
    })
  )
  engineSegments.set(hono, segments)
  return segments
}

/**
 * Mark a `POST` to the Sentry envelope path as a telemetry ingest request,
 * ahead of every `/api/*` guard. Ingest is OUTSIDE this ceiling: every app on
 * a shared host reports through one address, and a Sentry-compatible client
 * mutes all of its reporting for the `Retry-After` it is given, so one
 * address budget would silence a whole host. Each sender has its own budget
 * instead, counted by the protocol route once its key is known.
 *
 * A path whose `<project>` segment is a namespace of the engine's own routes
 * is NOT marked, so no other route answering under `/api/<x>/envelope`
 * escapes the ceiling through this exemption. A sender whose project segment
 * happens to equal one is still served by the telemetry route (which marks
 * the request itself); it is merely counted against the ceiling as well.
 */
const markSentryIngestOf =
  (hono: Readonly<Hono>): MiddlewareHandler =>
  async (c, next) => {
    const { path } = c.req
    if (
      c.req.method === 'POST' &&
      isSentryEnvelopePath(path) &&
      !engineSegmentsOf(hono).has(path.split('/')[2] ?? '')
    ) {
      markIngestRequest(c.req.raw)
    }
    await next()
  }

/**
 * Mount the ceiling on every path that can reach a session lookup: all of
 * `/api/*` (the health check is registered earlier and never reaches it;
 * Better Auth's `/api/auth/*` is registered later and does), and — when the
 * app has `auth` — the form routes, canonical and custom-path, which extract a
 * session too. One middleware instance, so all of them share ONE budget per
 * address.
 */
export const applyApiIpCeiling = <T extends Hono>(
  hono: T,
  app: App,
  authConfigured: boolean
): T => {
  const ceiling = ceilingOf(hono)
  const marked = declaresTelemetryProtocol(app.automations, 'sentry')
    ? (hono.use('/api/*', markSentryIngestOf(hono)) as T)
    : hono
  const withApi = marked.use('/api/*', ceiling) as T
  if (!authConfigured) return withApi
  return (app.forms ?? []).reduce<T>(
    (acc, form) => (typeof form.path === 'string' ? (acc.use(form.path, ceiling) as T) : acc),
    withApi.use('/forms/*', ceiling) as T
  )
}

/**
 * Mount the ceiling on the MCP endpoint, `POST` and `GET`, ahead of its
 * credential check. A mount under `/api/` was already counted there and
 * passes through.
 */
export const applyMcpIpCeiling = <T extends Hono>(hono: T, mountPath: string): T =>
  hono.on(['POST', 'GET'], mountPath, ceilingOf(hono)) as T

/** Built assets: never a page, never a lookup, never counted. */
const isStaticAssetPath = (path: string): boolean => path.startsWith('/assets/')

/**
 * Mount the ceiling ahead of the page, `.md` twin and console routes, for the
 * requests that carry a credential. One that carries none triggers no lookup,
 * so it is neither counted nor refused — a public audience behind one address
 * never spends the budget, and the page cache keeps serving it.
 */
export const applyCredentialedPageIpCeiling = <T extends Hono>(hono: T): T => {
  const ceiling = ceilingOf(hono)
  return hono.use('*', async (c, next) => {
    if (isStaticAssetPath(c.req.path) || !carriesCredential(c)) {
      await next()
      return
    }
    return ceiling(c, next)
  }) as T
}
