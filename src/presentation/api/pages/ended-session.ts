/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The redirect a page answers with, and what it does to a session that ended.
 *
 * When the request's session cookie named no session this browser may hold —
 * one presented from another browser, or one that no longer exists — the page
 * tier answered it as anonymous. Its redirect then expires the session cookies
 * exactly as signing out does, so the next sign-in starts from none; and when
 * the redirect is the one an access rule sends a signed-out visitor to sign in
 * with, it adds the marker the sign-in page reads to say the session ended.
 */

import { type Context } from 'hono'
import { setCookie } from 'hono/cookie'
import { withSessionEndedMarker } from '@/domain/models/app/auth/session-ended-marker'
import { PER_VISIT_CACHE_CONTROL } from './page-cache-decision'
import type { SessionCookie } from '@/application/ports/contracts/hono-app-config'

/** A page's redirect: its target, and whether it sends the visitor to sign in. */
export interface PageRedirect {
  readonly redirect: string
  readonly signIn?: true
}

/**
 * Send `resolved` as a 302, expiring `ended` cookies and marking a sign-in
 * redirect. A redirect that expires cookies is answered for this browser only,
 * so no cache between it and the server may keep it and replay it to another.
 */
export function sendPageRedirect(
  c: Context,
  resolved: PageRedirect,
  ended: readonly SessionCookie[] | undefined
): Response {
  if (ended === undefined) return c.redirect(resolved.redirect, 302)
  ended.forEach(({ name, attributes }) => setCookie(c, name, '', { ...attributes, maxAge: 0 }))
  c.header('Cache-Control', PER_VISIT_CACHE_CONTROL)
  const target =
    resolved.signIn === true ? withSessionEndedMarker(resolved.redirect) : resolved.redirect
  return c.redirect(target, 302)
}
