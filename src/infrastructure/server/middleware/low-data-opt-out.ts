/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /__sovrium/eco/low-data-opt-out` — endpoint backing the footer
 * "Show full version" link emitted by the low-data middleware.
 *
 * Sets the `sovrium_low_data=off` cookie (Path=`/`, SameSite=Lax, six-month
 * Max-Age) and 302s back to the `?next=` source path. The cookie is then
 * the explicit user override that beats every env-controlled posture in
 * `resolveLowDataMode`.
 *
 * Registered at the server-setup layer (sibling to the eco-index
 * middleware) so it is always available regardless of the schema's pages
 * configuration.
 */

import { setCookie } from 'hono/cookie'
import type { Context, Hono } from 'hono'

const COOKIE_NAME = 'sovrium_low_data'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180 // ~6 months

// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is mutable by library design
async function handleLowDataOptOut(c: Context): Promise<Response> {
  const rawNext = c.req.query('next')
  const next = typeof rawNext === 'string' && rawNext.startsWith('/') ? rawNext : '/'

  setCookie(c, COOKIE_NAME, 'off', {
    path: '/',
    sameSite: 'Lax',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    httpOnly: false,
  })

  return c.redirect(next, 302)
}

/** Chain the low-data opt-out route onto a Hono app. */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
export function chainLowDataOptOutRoute<T extends Hono>(honoApp: T): T {
  return honoApp.get('/__sovrium/eco/low-data-opt-out', handleLowDataOptOut) as T
}
