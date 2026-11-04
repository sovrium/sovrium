/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The cookie a signing link is exchanged for, read and written in one place:
 * every road acting in a signing session (the signing page, sign, decline, the
 * frozen document, a form bound to a flow, the code challenge) names its
 * signer through {@link signingSessionOf}.
 */

import { getCookie, setCookie } from 'hono/cookie'
import {
  openSigningSessionSeal,
  sealSigningSession,
} from '@/infrastructure/auth/signing-session-seal'
import { isTransportRelaxed } from '@/infrastructure/process/security-posture'
import type { SigningPage } from '@/domain/models/app/signatures/signing-page-service'
import type { Context } from 'hono'

/** The cookie a signing session is held in: a sealed signer id, never a link token. */
export const SIGNING_SESSION_COOKIE = 'sovrium_signing'

/** The signer the request's signing cookie names while it has not ended; `undefined` otherwise. */
export const signingSessionOf = (c: Context): string | undefined =>
  openSigningSessionSeal(getCookie(c, SIGNING_SESSION_COOKIE), Date.now())

/**
 * Hold a signing session for `signerId` in the response's cookie, for
 * `lifetimeSeconds`.
 *
 * `SameSite=Lax`, not `Strict`: a signing link is opened from a mail client,
 * a cross-site navigation, and a strict cookie set during one is withheld from
 * the redirect it answers with, so the signer would land on the not-found page.
 * Lax still keeps it off every cross-site sub-request and every cross-site
 * POST. `HttpOnly`, so no script reads it; `Secure` on a secure posture.
 */
export const holdSigningSession = (c: Context, signerId: string, lifetimeSeconds: number): void => {
  setCookie(
    c,
    SIGNING_SESSION_COOKIE,
    sealSigningSession(signerId, Date.now() + lifetimeSeconds * 1000),
    {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: !isTransportRelaxed() || new URL(c.req.url).protocol === 'https:',
      maxAge: lifetimeSeconds,
    }
  )
}

/** The request-scoped key a signing page's gate hands the page renderer its session's page under. */
const SIGNING_PAGE_KEY = 'signingPage'

/** Admit this request to render its signing page, as `page`. */
export const admitSigningPage = (c: Context, page: SigningPage): void => {
  c.set(SIGNING_PAGE_KEY, page)
}

/** The signing page the gate admitted this request to render; `undefined` when none. */
export const admittedSigningPage = (c: Context): SigningPage | undefined =>
  c.get(SIGNING_PAGE_KEY) as SigningPage | undefined
