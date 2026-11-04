/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The signing page's gate, and the frozen document its session reads. Both
 * anonymous by design: the link, then the session it was exchanged for, is
 * the only proof the request asks for when its flow verifies nothing more.
 *
 * - `GET <signing page path>` with a link token — a link that may act is
 *   exchanged for a signing session: `303` to the same page with `session` in
 *   place of the token and no query, and the session's cookie
 *   (`runtime/signing-session.ts`). The token never stays in the address bar,
 *   the history or a referrer.
 * - `GET <signing page path>` with `session` — the page renders, its
 *   components reading `$signing`, while the cookie names a signer of a flow
 *   whose `surface.page` is this page and her request has not ended.
 * - `GET /api/signatures/document` — the frozen copy the request
 *   fingerprinted, inside a session only.
 *
 * Everything else — an unknown, expired, used or withdrawn link, the
 * token-less address without a session, a session for another flow's page or
 * whose request ended — renders the one neutral not-found page, the same bytes
 * whatever the reason (S1). No signing page is ever served any other way: the
 * page renderer refuses a signing page it is not handed a session for.
 * Every answer here is sent with `Referrer-Policy: no-referrer`.
 */

import { Effect } from 'effect'
import {
  readSigningDocument,
  readSigningPage,
} from '@/application/use-cases/signatures/read-signing-page'
import { liveSigningSession } from '@/application/use-cases/signatures/sign-signature-request'
import { nowInstant } from '@/application/use-cases/signatures/signature-request-effects'
import { SIGNING_NOT_FOUND_BODY } from '@/domain/models/api/signatures/error'
import {
  SIGNING_SESSION_SEGMENT,
  signingSessionAddress,
  signingSessionLifetime,
  type SigningPageRef,
} from '@/domain/models/app/signatures/signing-page-service'
import {
  admitSigningPage,
  holdSigningSession,
  signingSessionOf,
} from '@/presentation/api/middleware/signing-session'
import { runHandlerEffect } from '@/presentation/api/runtime/run-effect'
import { signingNotFound } from './signing-session-handlers'
import type { App } from '@/domain/models/app'
import type { Context, Next } from 'hono'

/** The address a signing session's frozen document is served at. */
export const SIGNING_DOCUMENT_PATH = '/api/signatures/document'

/** The headers every answer of a signing road carries: no referrer, nothing kept. */
const noTrace = (c: Context): void => {
  c.header('Referrer-Policy', 'no-referrer')
  c.header('Cache-Control', 'no-store')
}

/** The neutral not-found page, in the request's language. */
const linkInvalid = (c: Context, app: App): Response => signingNotFound(c, app)

/** A link that may act is exchanged for a session and a redirect; any other, the neutral page. */
const exchangeLink = (c: Context, app: App, page: SigningPageRef, token: string | undefined) =>
  runHandlerEffect(
    c,
    Effect.zip(liveSigningSession(app, token), nowInstant).pipe(
      Effect.match({
        onFailure: () => linkInvalid(c, app),
        onSuccess: ([{ session }, now]) => {
          const lifetime = signingSessionLifetime(now.ms, [
            session.request.expiresAt,
            session.tokenExpiresAt,
          ])
          if (lifetime <= 0) return linkInvalid(c, app)
          holdSigningSession(c, session.signerId, lifetime)
          noTrace(c)
          return c.redirect(signingSessionAddress(c.req.path, page.path), 303)
        },
      })
    )
  )

/** The signing page the request's session shows on `page`, or `undefined`. */
const sessionPage = (c: Context, app: App, page: SigningPageRef) =>
  Effect.gen(function* () {
    const signerId = signingSessionOf(c)
    if (signerId === undefined) return undefined
    return yield* readSigningPage({
      ...{ app, signerId, pageName: page.name },
      documentUrl: SIGNING_DOCUMENT_PATH,
    }).pipe(
      // effect-swallow: every session that shows no page answers the one neutral page, whatever the reason (S1).
      Effect.orElseSucceed(() => undefined)
    )
  })

/**
 * The gate of one signing page: the link exchanged for a session, the
 * token-less address rendered in that session, anything else the neutral page.
 */
export const signingPageGate =
  (app: App, page: SigningPageRef) =>
  async (c: Context, next: Next): Promise<Response | void> => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next()
    const token = c.req.param('token')
    if (token !== SIGNING_SESSION_SEGMENT) return exchangeLink(c, app, page, token)
    const shown = await runHandlerEffect(
      c,
      sessionPage(c, app, page).pipe(
        Effect.map((signing) => {
          if (signing === undefined) return linkInvalid(c, app)
          admitSigningPage(c, signing)
          return c.body(null, 204)
        })
      )
    )
    if (shown.status !== 204) return shown
    await next()
    noTrace(c)
    return undefined
  }

/** `GET /api/signatures/document`: the frozen copy, inside a live signing session only. */
export const handleSigningDocument = (c: Context, app: App): Promise<Response> => {
  const signerId = signingSessionOf(c)
  noTrace(c)
  if (signerId === undefined) return Promise.resolve(c.json(SIGNING_NOT_FOUND_BODY, 404))
  return runHandlerEffect(
    c,
    readSigningDocument(app, signerId).pipe(
      Effect.match({
        onFailure: () => c.json(SIGNING_NOT_FOUND_BODY, 404),
        onSuccess: (bytes) =>
          c.body(new Uint8Array(bytes), 200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="document.pdf"',
            'X-Content-Type-Options': 'nosniff',
          }),
      })
    )
  )
}
