/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getCookie } from 'hono/cookie'
import {
  FORM_FLASH_COOKIE,
  decodeFlash,
  withFlashToast,
} from '@/presentation/api/runtime/form-flash'
import type { Hono } from 'hono'

const CLEAR_FLASH = `${FORM_FLASH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`

/**
 * Show a form's carried toast on the page its document POST landed on, once
 * (`runtime/form-flash.ts`). The first HTML page served while the cookie is
 * held draws the toast and clears the cookie, so a reload does not repeat it;
 * the answer is never stored by a cache, which would replay it.
 */
export const applyFormFlash = <T extends Hono>(hono: T): T =>
  hono.use('*', async (c, next) => {
    const raw = c.req.method === 'GET' ? getCookie(c, FORM_FLASH_COOKIE) : undefined
    await next()
    if (raw === undefined || c.res.status !== 200) return
    if (!(c.res.headers.get('Content-Type') ?? '').includes('text/html')) return
    const flash = decodeFlash(raw)
    const headers = new Headers(c.res.headers)
    headers.delete('ETag')
    headers.delete('Content-Length')
    headers.set('Cache-Control', 'no-store')
    headers.append('Set-Cookie', CLEAR_FLASH)
    const body =
      flash === undefined ? await c.res.text() : withFlashToast(await c.res.text(), flash)
    // Cleared first: Hono's setter would copy the old headers back over these.
    // eslint-disable-next-line no-param-reassign -- Hono's middleware contract replaces the response by assignment
    c.res = undefined
    // eslint-disable-next-line no-param-reassign -- as above
    c.res = new Response(body, { status: 200, headers })
  }) as T
