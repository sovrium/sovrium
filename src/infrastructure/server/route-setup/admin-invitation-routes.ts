/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  acceptInvitation as acceptInvitationUseCase,
  inviteUser as inviteUserUseCase,
} from '@/application/use-cases/auth/admin-invitation'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { resolvePasswordPolicy } from '@/domain/utils/password-policy'
import { logError } from '@/infrastructure/logging/logger'
import type { Auth } from '@/domain/models/app/auth'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'
import type { Context, Hono } from 'hono'

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>
type EmailHandlers = Readonly<ReturnType<typeof createEmailHandlers>>

interface SessionLike {
  readonly user: { readonly id: string; readonly name?: string }
  readonly session: { readonly userId: string }
}

/**
 * Compute the absolute base URL for the current request.
 *
 * Priority order:
 *   1. The configured `BASE_URL` environment variable (production / when set).
 *   2. The request origin from the `Origin` / `Referer` header.
 *   3. A best-effort reconstruction from `Host` + `X-Forwarded-Proto`.
 *
 * Tests run on `http://localhost:<random-port>` and the request's `Origin`
 * header carries that port, so the returned URL stays in-host with the
 * test server.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
const resolveBaseURL = (c: Context): string => {
  const envUrl = process.env['BASE_URL']
  if (envUrl) return envUrl.replace(/\/$/, '')

  const origin = c.req.header('origin')
  if (origin) return origin.replace(/\/$/, '')

  const referer = c.req.header('referer')
  if (referer) {
    try {
      const u = new URL(referer)
      return `${u.protocol}//${u.host}`
    } catch {
      // fall through
    }
  }

  const host = c.req.header('host') ?? 'localhost'
  const proto = c.req.header('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

/**
 * Resolve the admin caller's session and verify their role is `admin`.
 *
 * Returns the JSON Response when authorization fails (401/403). Returns the
 * authenticated session when successful so the handler has access to the
 * inviter's display name.
 */
const requireAdminCaller = async (
  authInstance: AuthInstance,
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
  c: Context
): Promise<{ readonly session: SessionLike } | Response> => {
  const callerSession = (await authInstance.api.getSession({
    headers: c.req.raw.headers,
  })) as SessionLike | null

  if (!callerSession) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const role = await getUserRole(callerSession.session.userId)
  if (role !== 'admin') {
    return c.json({ success: false, message: 'Admin access required', code: 'FORBIDDEN' }, 403)
  }

  return { session: callerSession }
}

/**
 * Map a non-success invite-user result onto an HTTP response.
 *
 * Pre-condition: caller has confirmed `result.status !== 'invited'`. The
 * status discriminator drives the HTTP code: `invalid-input` → 400,
 * `already-onboarded` → 422 (email already maps to a fully-onboarded user),
 * everything else → 500.
 */
const respondToInviteFailure = (
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
  c: Context,
  result: { readonly status: string; readonly message: string }
): Response => {
  if (result.status === 'invalid-input') {
    return c.json({ success: false, message: result.message, code: 'BAD_REQUEST' }, 400)
  }
  if (result.status === 'already-onboarded') {
    return c.json(
      { success: false, message: result.message, code: 'EMAIL_ALREADY_REGISTERED' },
      422
    )
  }
  return c.json({ success: false, message: result.message, code: 'INTERNAL_ERROR' }, 500)
}

/**
 * POST /api/auth/admin/invite-user
 *
 * Admin-issued passwordless invitation. Accepts `{ email, name, role }`,
 * generates a single-use token, persists it in `auth.verification` (with
 * identifier prefix `invitation:`), and emails the invitee a link to
 * `/accept-invitation?token=...`.
 *
 * - 401 when caller has no session
 * - 403 when caller is not an admin
 * - 422 when the email maps to a fully-onboarded user
 * - 200 with `{ user, invitationSent: true }` on success
 *
 * NOT a Better Auth plugin endpoint — implemented in the Sovrium engine.
 * `allowSignUp:false` does NOT block this endpoint (admin-driven invitation
 * remains the only onboarding path when self-signup is disabled).
 */
const createInviteUserHandler =
  (authInstance: AuthInstance, authConfig: Auth | undefined, emailHandlers: EmailHandlers) =>
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
  async (c: Context) => {
    try {
      const authorized = await requireAdminCaller(authInstance, c)
      if (authorized instanceof Response) return authorized

      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
      const inviterName = authorized.session.user.name ?? 'An administrator'

      const result = await inviteUserUseCase({
        authInstance,
        authConfig,
        emailHandlers,
        baseURL: resolveBaseURL(c),
        inviterName,
        body,
      })

      if (result.status !== 'invited') {
        return respondToInviteFailure(c, result)
      }

      return c.json(
        {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
          },
          invitationSent: true,
        },
        200
      )
    } catch (error) {
      logError('[admin-invitation] invite-user handler crashed', error)
      return c.json(
        { success: false, message: 'Failed to issue invitation', code: 'INTERNAL_ERROR' },
        500
      )
    }
  }

interface AcceptedInvitationUser {
  readonly id: string
  readonly email: string
  readonly name: string
}

/**
 * Map a non-success accept-invitation result onto an HTTP response.
 *
 * Pre-condition: caller has confirmed `result.status !== 'accepted'`. The
 * result is narrowed to the failure union so each branch knows it has a
 * `message`. 410 is reserved for token expiry; everything else is 4xx
 * (client error) or 5xx (internal error).
 */
const respondToAcceptFailure = (
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
  c: Context,
  result: { readonly status: string; readonly message: string }
): Response => {
  if (result.status === 'invalid-input') {
    return c.json({ success: false, message: result.message, code: 'BAD_REQUEST' }, 400)
  }
  if (result.status === 'invalid-token') {
    return c.json({ success: false, message: result.message, code: 'INVALID_TOKEN' }, 400)
  }
  if (result.status === 'expired-token') {
    return c.json({ success: false, message: result.message, code: 'TOKEN_EXPIRED' }, 410)
  }
  return c.json({ success: false, message: result.message, code: 'INTERNAL_ERROR' }, 500)
}

/**
 * Forward `Set-Cookie` headers from the Better Auth sign-in response onto a
 * fresh response carrying our own JSON body.
 *
 * Better Auth's `asResponse: true` mode returns a `Response` whose body we
 * don't want (it is the standard sign-in payload), but whose cookies we
 * absolutely DO want — they carry the customer's freshly-minted session.
 */
const buildResponseWithForwardedCookies = (
  signInResponse: Readonly<Response>,
  user: AcceptedInvitationUser
): Response => {
  const responseBody = {
    user: { id: user.id, email: user.email, name: user.name },
    status: 'accepted',
  }
  const headers = new Headers({ 'content-type': 'application/json' })
  signInResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      headers.append('set-cookie', value)
    }
  })
  return new Response(JSON.stringify(responseBody), { status: 200, headers })
}

/**
 * Sign the freshly-onboarded customer in by delegating to Better Auth.
 *
 * If Better Auth surfaces an error (rare — the password was just set), we
 * soft-fail to a 200 with `sessionEstablished: false` so the customer can
 * proceed via the regular sign-in form rather than seeing a 500.
 */
const buildPostAcceptResponse = async (
  authInstance: AuthInstance,
  user: AcceptedInvitationUser,
  password: string
): Promise<Response> => {
  try {
    const signInResponse = (await authInstance.api.signInEmail({
      body: { email: user.email, password, rememberMe: false },
      asResponse: true,
    })) as Response
    return buildResponseWithForwardedCookies(signInResponse, user)
  } catch (error) {
    logError('[admin-invitation] post-accept sign-in failed', error)
    return new Response(
      JSON.stringify({
        user: { id: user.id, email: user.email, name: user.name },
        status: 'accepted',
        sessionEstablished: false,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }
}

/**
 * POST /api/auth/admin/accept-invitation
 *
 * Public endpoint — the customer is unauthenticated. Validates the token,
 * sets the customer's password (links a credential account row), marks
 * email verified, consumes the token, and signs the customer in by
 * delegating to Better Auth's `/sign-in/email` endpoint so the response
 * carries a valid Set-Cookie session header.
 *
 * - 400 / 410 when the token is invalid, already used, or expired
 * - 200 with the customer's user record on success (cookie set on response)
 */
const createAcceptInvitationHandler =
  (authInstance: AuthInstance, authConfig: Auth | undefined) =>
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
  async (c: Context) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
      const result = await acceptInvitationUseCase({ authInstance, authConfig, body })

      if (result.status !== 'accepted') {
        return respondToAcceptFailure(c, result)
      }

      const password = (body as { readonly password?: string }).password as string
      return await buildPostAcceptResponse(authInstance, result.user, password)
    } catch (error) {
      logError('[admin-invitation] accept-invitation handler crashed', error)
      return c.json(
        { success: false, message: 'Failed to accept invitation', code: 'INTERNAL_ERROR' },
        500
      )
    }
  }

/**
 * Escape an arbitrary string for safe interpolation into HTML attributes.
 *
 * The token alphabet is `[A-Za-z0-9_-]+` so this should be a no-op in
 * practice, but defensive escaping keeps us safe if the alphabet ever
 * widens or a malformed query string sneaks through.
 */
const escapeHtmlAttribute = (value: string): string =>
  value.replace(/[<>"'&]/g, (ch) => {
    if (ch === '<') return '&lt;'
    if (ch === '>') return '&gt;'
    if (ch === '"') return '&quot;'
    if (ch === "'") return '&#39;'
    return '&amp;'
  })

const ACCEPT_INVITATION_STYLE = `
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 420px; margin: 4rem auto; padding: 0 1rem; }
  h1 { font-size: 1.5rem; margin-bottom: 1rem; }
  label { display: block; margin-top: 1rem; font-weight: 500; }
  input { display: block; width: 100%; box-sizing: border-box; padding: 0.5rem; margin-top: 0.25rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
  button { margin-top: 1.5rem; padding: 0.75rem 1.25rem; background: #0c0c0c; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; width: 100%; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .error { margin-top: 1rem; color: #b91c1c; }
`

/**
 * Build the inline client-side script for the accept-invitation page.
 *
 * The minimum password length is interpolated as a server-rendered
 * constant so the gate matches the configured `auth.strategies` policy
 * (single source of truth: `resolvePasswordPolicy`). The server still
 * re-validates on POST, so a tampered client value cannot bypass the
 * policy — this gate exists for UX (instant feedback) only.
 */
const buildAcceptInvitationScript = (minPasswordLength: number): string => `
  (function () {
    var MIN_PASSWORD_LENGTH = ${minPasswordLength};
    var form = document.getElementById('accept-form');
    var errorEl = document.getElementById('error');
    var passwordEl = document.getElementById('password');
    var confirmEl = document.getElementById('confirm-password');
    var submitBtn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errorEl.textContent = '';
      if (passwordEl.value !== confirmEl.value) {
        errorEl.textContent = 'Passwords do not match';
        return;
      }
      if (!passwordEl.value || passwordEl.value.length < MIN_PASSWORD_LENGTH) {
        errorEl.textContent = 'Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters';
        return;
      }
      submitBtn.disabled = true;
      try {
        var formData = new FormData(form);
        var token = formData.get('token');
        var resp = await fetch('/api/auth/admin/accept-invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: token, password: passwordEl.value }),
        });
        if (!resp.ok) {
          var data = await resp.json().catch(function () { return {}; });
          errorEl.textContent = (data && data.message) || 'Failed to accept invitation';
          submitBtn.disabled = false;
          return;
        }
        window.location.href = '/';
      } catch (err) {
        errorEl.textContent = 'Network error — please try again';
        submitBtn.disabled = false;
      }
    });
  })();
`

/**
 * Render the SSR HTML for the accept-invitation page.
 *
 * The form is intentionally minimal — it relies on plain HTML + a tiny
 * inline script so the page works even if the Sovrium UI bundle is not
 * configured for this app. The form labels (`Password`, `Confirm
 * password`) match the spec assertions verbatim.
 */
const renderAcceptInvitationPage = (token: string, minPasswordLength: number): string => {
  const escapedToken = escapeHtmlAttribute(token)
  const script = buildAcceptInvitationScript(minPasswordLength)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Accept invitation</title>
  <style>${ACCEPT_INVITATION_STYLE}</style>
</head>
<body>
  <main>
    <h1>Accept invitation</h1>
    <p>Choose a password to complete your onboarding.</p>
    <form id="accept-form" novalidate>
      <input type="hidden" name="token" value="${escapedToken}" />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="new-password" required />
      <label for="confirm-password">Confirm password</label>
      <input id="confirm-password" name="confirm-password" type="password" autocomplete="new-password" required />
      <button type="submit">Accept invitation</button>
      <p id="error" class="error" role="alert" aria-live="polite"></p>
    </form>
  </main>
  <script>${script}</script>
</body>
</html>`
}

/**
 * GET /accept-invitation
 *
 * Server-rendered HTML form so the customer can set their password.
 * Submits to POST /api/auth/admin/accept-invitation via fetch, then
 * redirects to "/" (the standard authenticated entry point) on success.
 */
const createAcceptInvitationPageHandler =
  (authConfig: Auth | undefined) =>
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is third-party mutable type
  async (c: Context) => {
    const token = c.req.query('token') ?? ''
    const { minLength } = resolvePasswordPolicy(authConfig)
    // The page is always served — even if `token` is empty — so the customer
    // gets a clear error instead of a 404 when they click a malformed link.
    const html = renderAcceptInvitationPage(token, minLength)
    return c.html(html, 200)
  }

/**
 * Mount the admin invitation routes onto a Hono app.
 *
 * Order of registration matters — these routes must be added BEFORE the
 * Better Auth catch-all `/api/auth/*` handler so the specific paths win.
 * The HTML page (/accept-invitation) is also registered here so the auth
 * route module owns the full flow and the customer never bounces through
 * the dynamic-page renderer.
 */
export const chainAdminInvitationRoutes = (
  app: Readonly<Hono>,
  authInstance: AuthInstance,
  authConfig: Auth | undefined,
  emailHandlers: EmailHandlers
): Readonly<Hono> => {
  const inviteHandler = createInviteUserHandler(authInstance, authConfig, emailHandlers)
  const acceptApiHandler = createAcceptInvitationHandler(authInstance, authConfig)
  const acceptPageHandler = createAcceptInvitationPageHandler(authConfig)
  return app
    .post('/api/auth/admin/invite-user', inviteHandler)
    .post('/api/auth/admin/accept-invitation', acceptApiHandler)
    .get('/accept-invitation', acceptPageHandler)
}
