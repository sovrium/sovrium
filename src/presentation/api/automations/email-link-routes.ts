/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  isValidUnsubscribeToken,
  recordOpenByToken,
  unsubscribeByToken,
} from '@/application/use-cases/automations/email-links'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import type { Context, Hono } from 'hono'

/**
 * The two addresses a bulk message's links point at.
 *
 * - `/api/email/unsubscribe?token=…`: a `POST` (the RFC 8058 one-click a
 *   mailbox provider sends, or the confirmation button) unsubscribes and
 *   answers `200`; a `GET` shows a confirmation page whose button posts, and
 *   changes nothing, so a link scanner following it unsubscribes nobody. A
 *   token that was altered, forged or has expired answers `404`.
 * - `/api/email/open/:token`: always the same transparent GIF, never cached;
 *   a valid token counts the message's first open.
 *
 * Neither needs a session: the token is the credential. Neither echoes the
 * address the token names.
 */

/** A 1×1 transparent GIF, the same bytes for every token. */
const TRANSPARENT_GIF = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (char) => char.charCodeAt(0)
)

/** A small page, the same for every recipient, naming nobody. */
const page = (title: string, body: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`

const CONFIRM_PAGE = (action: string): string =>
  page(
    'Unsubscribe',
    `<p>Stop receiving this mailing list at this address?</p><form method="post" action="${action}"><button type="submit">Unsubscribe</button></form>`
  )

const DONE_PAGE = page(
  'You are unsubscribed',
  '<p>You will not receive this mailing list again.</p>'
)

/** The token from the query, or the empty string (which answers `404` before any lookup). */
const tokenOf = (c: Context): string => c.req.query('token') ?? ''

const handleConfirm = async (c: Context): Promise<Response> => {
  const token = tokenOf(c)
  if (token === '') return notFound(c)
  const valid = await runRequestEffect(c, provideDomain(c, isValidUnsubscribeToken(token)))
  if (!valid) return notFound(c)
  return c.html(CONFIRM_PAGE(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`), 200, {
    'Cache-Control': 'no-store',
  })
}

const handleUnsubscribe = async (c: Context): Promise<Response> => {
  const token = tokenOf(c)
  if (token === '') return notFound(c)
  const done = await runRequestEffect(c, provideDomain(c, unsubscribeByToken(token)))
  if (!done) return notFound(c)
  return c.html(DONE_PAGE, 200, { 'Cache-Control': 'no-store' })
}

const handleOpen = async (c: Context): Promise<Response> => {
  await runRequestEffect(
    c,
    provideDomain(c, recordOpenByToken(c.req.param('token') ?? '')).pipe(
      Effect.tapCause((cause) => Effect.logError('email open could not be counted', cause)),
      // effect-swallow: the pixel answers the same image whatever happens; a count
      // that could not be written only lowers a figure the manual calls a lower bound.
      Effect.ignore
    )
  )
  return c.body(TRANSPARENT_GIF, 200, {
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, max-age=0',
  })
}

/** Chain the unsubscribe and open addresses. */
export const chainEmailLinkRoutes = <T extends Hono>(honoApp: T): T =>
  honoApp
    .get('/api/email/unsubscribe', handleConfirm)
    .post('/api/email/unsubscribe', handleUnsubscribe)
    .get('/api/email/open/:token', handleOpen) as T
