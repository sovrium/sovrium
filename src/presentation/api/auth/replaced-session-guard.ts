/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A late answer to a REPLACED session does not sign the browser out.
 *
 * Confirming or turning off two-step verification replaces the session: the
 * response sets a new session cookie and the old session is deleted. A request
 * the page sent just before, still carrying the old cookie, is answered after
 * that with a `Set-Cookie` clearing the session cookie (Better Auth clears a
 * cookie whose session it cannot find) — and the browser, which already holds
 * the NEW cookie, drops it.
 *
 * So every auth response that replaces the session the request carried
 * remembers the old token for a while, and a later answer to a request
 * carrying a remembered token has its session-clearing `Set-Cookie` headers
 * left out. Nothing else changes: the old session is still gone (that request
 * is answered as signed out), and a session that ended any other way —
 * signed out, revoked, expired — was never replaced, so its cookie is still
 * cleared. A sign-out always clears, and a token a later response sets again
 * (ending an impersonation restores the admin's) is current again and
 * forgotten. Held in memory, per instance: a deployment is one instance.
 */

import {
  clearsSessionCookie,
  forgetTokens,
  isRemembered,
  parseSetCookie,
  rememberToken,
  replacesSession,
  sessionTokenIn,
  sessionTokensSet,
  type RememberedTokens,
} from '@/domain/models/app/auth/session-cookie-rotation-service'
import type { Hono } from 'hono'

/** How long a replaced token is remembered: far past any request in flight at the change. */
const REPLACED_FOR_MS = 10 * 60 * 1000

/** At most this many replaced tokens are remembered; the oldest is forgotten first. */
const MAX_REPLACED = 10_000

/** The one route whose clearing is always kept: the reader asked to be signed out. */
const SIGN_OUT_PATH = '/api/auth/sign-out'

/** Replaced session tokens, each with the instant it is forgotten (insertion-ordered). */
let replacedTokens: RememberedTokens = new Map()

const LIMITS = { forMs: REPLACED_FOR_MS, max: MAX_REPLACED } as const

/** `response` with only the `kept` `Set-Cookie` headers. */
const withoutSetCookies = (response: Response, kept: readonly string[]): Response => {
  const headers = new Headers(response.headers)
  headers.delete('set-cookie')
  kept.forEach((header) => headers.append('set-cookie', header))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Register the guard on every auth route. Registered ahead of them, so it
 * wraps each handler: it reads the request's session token, lets the route
 * answer, then reads what the answer sets.
 */
export const applyReplacedSessionGuard = (honoApp: Readonly<Hono>): Readonly<Hono> =>
  honoApp.use('/api/auth/*', async (c, next) => {
    const token = sessionTokenIn(c.req.header('cookie'))
    await next()
    if (token === undefined) return
    const headers = c.res.headers.getSetCookie()
    if (headers.length === 0) return
    const now = Date.now()
    const read = headers.flatMap((header) => parseSetCookie(header) ?? [])
    // A token set again is current again (ending an impersonation restores
    // the admin's): it is no longer a replaced one.
    replacedTokens = forgetTokens(replacedTokens, sessionTokensSet(read))
    if (replacesSession(token, read)) {
      replacedTokens = rememberToken(replacedTokens, token, now, LIMITS)
      return
    }
    // An explicit sign-out always clears what it signs out of.
    if (c.req.path === SIGN_OUT_PATH || !isRemembered(replacedTokens, token, now)) return
    const kept = headers.filter((header) => {
      const entry = parseSetCookie(header)
      return entry === undefined || !clearsSessionCookie(entry)
    })
    if (kept.length === headers.length) return
    const answer = withoutSetCookies(c.res, kept)
    // Hono's `res` setter merges the previous response's headers back in;
    // clearing it first keeps the dropped Set-Cookie headers dropped.
    // eslint-disable-next-line no-param-reassign -- Hono's middleware contract replaces the response by assignment
    c.res = undefined
    // eslint-disable-next-line no-param-reassign -- as above
    c.res = answer
  })
