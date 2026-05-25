/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { setCookie } from 'hono/cookie'
import type { Context, Hono } from 'hono'

const COOKIE_NAME = 'sovrium_low_data'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180

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

export function chainLowDataOptOutRoute<T extends Hono>(honoApp: T): T {
  return honoApp.get('/__sovrium/eco/low-data-opt-out', handleLowDataOptOut) as T
}
