/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A request that carries the visitor's session cookie and changes something,
 * or opens a live subscription, is refused `403` when another site sent it.
 *
 * `SameSite=Lax` keeps the cookie off most forged requests, but not all: a
 * top-level form post, a same-site sibling domain, a `SameSite=None` cookie
 * on a deployment that lists other origins, and a WebSocket handshake (which
 * no CORS preflight ever guards) all carry it. The JSON-only guard
 * (`json-body.ts`) refuses a forged body, but a POST with no body at all, a
 * multipart form, a WebSocket or an event stream has no body to refuse. So
 * every route is judged here, at the head of the chain, before any session is
 * read or any handler runs.
 *
 * Judged: a request carrying the session cookie that is `POST`, `PUT`,
 * `PATCH` or `DELETE`, a WebSocket upgrade, a `GET` on one of the
 * event-stream subscriptions, or ANY request to an automation's webhook. A
 * `GET` is otherwise safe to let through, since it reads and changes
 * nothing; a webhook breaks that assumption, because a `GET` to one starts a
 * run, and a link on another site that a signed-in visitor follows is a
 * cross-site `GET` carrying her cookie. Refused when its `Origin` is neither trusted
 * (the app's own, an SSO provider's, one `SOVRIUM_CORS_ORIGINS` lists) nor the
 * origin the request itself was addressed to — a page on another site cannot
 * make its `Origin` name the host it is attacking — or, with no `Origin`, when
 * the browser marks it `Sec-Fetch-Site: cross-site`. A request with neither
 * header comes from a server or a script, not a browser acting for a visitor,
 * and is served. The sign-in routes are judged too: Better Auth's own check,
 * which is stricter, still runs after this one, and the routes Sovrium
 * registers under `/api/auth/*` itself have no other.
 *
 * Armed on a secure posture only (`isTransportRelaxed()` false): a loopback
 * development server, where the cookie is not `Secure` either, is left alone.
 */

import { confineHost, trustedForwarding } from '@/domain/kernel/url/request-base-url'
import { hasSessionCookie } from '@/domain/models/app/auth/session-cookie'
import { isTransportRelaxed } from '@/infrastructure/process/security-posture'
import { forbidden } from '@/presentation/api/runtime/auth-helpers'
import { readRequestOriginSettings } from '@/presentation/api/runtime/request-origin'
import type { Context, MiddlewareHandler } from 'hono'

/** The methods that change state. */
const STATE_CHANGING_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** The event-stream subscriptions a `GET` opens: a table's feed, presence, the app connection. */
const SUBSCRIPTION_PATH =
  /^\/api\/(?:tables\/[^/]+\/subscribe(?:\/sse)?|realtime\/(?:presence|connection))$/

/** An automation's webhook, whatever its method: every call to one starts a run. */
const WEBHOOK_PATH = /^\/api\/automations\/[^/]+\/webhook$/

const isWebSocketUpgrade = (c: Context): boolean =>
  (c.req.header('upgrade') ?? '').toLowerCase() === 'websocket'

/** Does this request act for the signed-in visitor in a way another site must not trigger? */
const isJudged = (c: Context): boolean => {
  if (!hasSessionCookie(c.req.header('cookie'))) return false
  if (STATE_CHANGING_METHODS.has(c.req.method) || isWebSocketUpgrade(c)) return true
  if (WEBHOOK_PATH.test(c.req.path)) return true
  return c.req.method === 'GET' && SUBSCRIPTION_PATH.test(c.req.path)
}

/** The host (`name[:port]`) the request was addressed to, as a declared proxy forwarded it. */
const addressedHost = (c: Context): string | undefined => {
  const header = (name: string) => c.req.header(name)
  return (
    trustedForwarding(header, readRequestOriginSettings().trustedProxyHops).host ??
    confineHost(header('host'))
  )?.toLowerCase()
}

/** Is `origin` an `http(s)` origin naming the very host the request was addressed to? */
const isOwnOrigin = (c: Context, origin: string): boolean => {
  if (!URL.canParse(origin)) return false
  const parsed = new URL(origin)
  const host = addressedHost(c)
  return (
    (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    host !== undefined &&
    parsed.host.toLowerCase() === host
  )
}

/** Did another site send this request? */
const isCrossSite = (c: Context, trustedOrigins: readonly string[]): boolean => {
  const origin = c.req.header('origin')
  const fetchSite = c.req.header('sec-fetch-site')
  if (origin === undefined) return fetchSite === 'cross-site'
  // A same-origin form sent with `no-referrer` names its origin `null`; the
  // browser still says where it came from.
  if (origin === 'null') return fetchSite !== 'same-origin'
  return !trustedOrigins.includes(origin) && !isOwnOrigin(c, origin)
}

/**
 * The guard, or a pass-through when the posture is relaxed. `trustedOrigins`
 * is the app's list (`appTrustedOrigins`), normalised as `Origin` writes them.
 */
export const crossSiteRequestGuard = (trustedOrigins: readonly string[]): MiddlewareHandler => {
  if (isTransportRelaxed()) return async (_c, next) => next()
  return async (c, next) =>
    isJudged(c) && isCrossSite(c, trustedOrigins)
      ? forbidden(c, 'Cross-site request refused')
      : next()
}
