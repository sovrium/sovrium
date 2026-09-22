/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { InvitationTokenRepository } from '@/application/ports/repositories/auth/invitation-token-repository'
import {
  acceptInvitation as acceptInvitationUseCase,
  inviteUser as inviteUserUseCase,
} from '@/application/use-cases/auth/admin-invitation'
import { resolvePasswordPolicy } from '@/domain/models/app/auth/password-policy'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { requireInviteCaller, resolveBaseURL } from '@/presentation/api/auth/admin-invitation-guard'
import { chainAdminInvitationLifecycleRoutes } from '@/presentation/api/auth/admin-invitation-lifecycle-routes'
import type { App } from '@/domain/models/app'
import type { Auth } from '@/domain/models/app/auth'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'
import type { Context, Hono } from 'hono'

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>
type EmailHandlers = Readonly<ReturnType<typeof createEmailHandlers>>

/**
 * Map a non-success invite-user result onto an HTTP response.
 *
 * Pre-condition: caller has confirmed `result.status !== 'invited'`. The
 * status discriminator drives the HTTP code: `invalid-input` → 400,
 * `already-onboarded` → 422 (email already maps to a fully-onboarded user),
 * everything else → 500.
 */
const respondToInviteFailure = (
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
 * - 404 when the caller may not invite this role (S1 — never 403): neither
 *   admin-equivalent, nor holding `auth.roles[].canInvite` at a level at or
 *   above the invited role. See `canInviteRole`.
 * - 400 when the requested role is not assignable for this app
 * - 422 when the email maps to a fully-onboarded user
 * - 200 with `{ user, invitationSent: true }` on success
 *
 * The body is parsed BEFORE the guard runs, because the guard's ceiling is a
 * comparison against the invited role and that role arrives in the body. Parsing
 * first is not a widening: it is a `JSON.parse` with no side effects, anonymous
 * callers are already 401ed by the upstream auth middleware, and an unparseable
 * body yields `{}`, whose absent role denies every non-admin-equivalent caller.
 *
 * NOT a Better Auth plugin endpoint — implemented in the Sovrium engine.
 * `allowSignUp:false` does NOT block this endpoint (admin-driven invitation
 * remains the only onboarding path when self-signup is disabled).
 */
const createInviteUserHandler =
  (
    authInstance: AuthInstance,
    authConfig: Auth | undefined,
    emailHandlers: EmailHandlers,
    app: Readonly<App> | undefined
  ) =>
  async (c: Context) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
      const requestedRole = typeof body['role'] === 'string' ? body['role'].trim() : undefined

      const authorized = await requireInviteCaller(authInstance, c, app, requestedRole)
      if (authorized instanceof Response) return authorized

      const inviterName = authorized.session.user.name ?? 'An administrator'

      const result = await inviteUserUseCase({
        authInstance,
        authConfig,
        emailHandlers,
        baseURL: resolveBaseURL(c),
        inviterName,
        // The inviter's own role, so the flow can tell a SCOPED inviter (whose
        // tenant the invitee must inherit) from an admin-equivalent one (who has
        // no tenant to pass on).
        inviterRole: authorized.role,
        // Recorded on the invitation so the pending list can answer "who sent
        // this?" — previously persisted nowhere, which is why an operator
        // could not tell their own outstanding invitations from a colleague's.
        inviterId: authorized.session.user.id,
        app: app ?? {},
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
  (authInstance: AuthInstance, authConfig: Auth | undefined) => async (c: Context) => {
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
 * The dead-end page for a link that no longer opens anything.
 *
 * An invitation can stop working while it is still sitting in someone's inbox —
 * the operator revoked it, it lapsed, or it was already accepted — and the link
 * looks identical either way. Serving the password form anyway meant the invitee
 * chose a password, submitted, and only then learned the link was dead: they had
 * to do work to be told no. The page now says so on arrival.
 *
 * Deliberately vague about WHICH of those happened, and deliberately identical
 * for a token that never existed: a page that distinguished "revoked" from
 * "unknown" would confirm to anyone guessing tokens that a particular guess had
 * once been real.
 *
 * No retry control. There is nothing the holder of a dead link can do except ask
 * the person who invited them, so that is what it says.
 */
const renderInvitationUnavailablePage = (): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Invitation unavailable</title>
  <style>${ACCEPT_INVITATION_STYLE}</style>
</head>
<body>
  <main>
    <h1>This invitation is no longer available</h1>
    <p class="error" role="alert">This invitation link has expired or been withdrawn. Ask whoever invited you to send a new one.</p>
  </main>
</body>
</html>`

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
 * Whether this token still opens an invitation.
 *
 * A read, never a mutation: the row is consumed by `POST /accept-invitation`,
 * which re-checks everything this checks. A database failure answers `true` so a
 * transient outage shows the form (and the POST refuses properly) rather than
 * telling a legitimate invitee their link is dead.
 */
const isInvitationOpenable = async (c: Context, token: string): Promise<boolean> => {
  if (token.length === 0) return false
  const lookup = Effect.gen(function* () {
    const repository = yield* InvitationTokenRepository
    const invitation = yield* repository.findByToken(token)
    return invitation !== undefined && invitation.expiresAt.getTime() > Date.now()
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[admin-invitation] accept-invitation page token check failed', cause)
      )
    ),
    // effect-swallow: FAIL OPEN, deliberately. A transient database outage must
    // show the password form — which refuses properly on POST — rather than tell
    // a legitimate invitee their link is dead and send them chasing a broken
    // link. The cause is logged above, so the outage is visible to an operator.
    Effect.orElseSucceed(() => true)
  )
  return runDomainPromise(c, lookup)
}

/**
 * GET /accept-invitation
 *
 * Server-rendered HTML form so the customer can set their password.
 * Submits to POST /api/auth/admin/accept-invitation via fetch, then
 * redirects to "/" (the standard authenticated entry point) on success.
 *
 * A token that no longer opens anything gets the dead-end page instead of the
 * form. Still 200, not 404: the ROUTE exists and the invitee reached the right
 * place — the thing that is gone is their invitation, and a 404 would send them
 * looking for a broken link instead of for the person who invited them.
 */
const createAcceptInvitationPageHandler = (authConfig: Auth | undefined) => async (c: Context) => {
  const token = c.req.query('token') ?? ''
  if (!(await isInvitationOpenable(c, token))) {
    return c.html(renderInvitationUnavailablePage(), 200)
  }
  const { minLength } = resolvePasswordPolicy(authConfig)
  const html = renderAcceptInvitationPage(token, minLength)
  return c.html(html, 200)
}

/**
 * Mount the admin invitation routes onto a Hono app.
 *
 * Order of registration matters — these routes must be added BEFORE the
 * Better Auth catch-all `/api/auth/*` handler so the specific paths win.
 * The built-in HTML page (/accept-invitation) is also registered here so the
 * auth route module owns the full flow and the customer never bounces through
 * the dynamic-page renderer.
 *
 * EXCEPTION: when the app config defines its OWN page at `/accept-invitation`,
 * the built-in fallback page is NOT registered — the user-defined page wins.
 * The POST API handler is always registered (it backs both the built-in and
 * any custom page's submit). This lets apps (e.g. apps/partner) brand the
 * activation page while still relying on the engine's invitation flow.
 */
export const chainAdminInvitationRoutes = (
  honoApp: Readonly<Hono>,
  authInstance: AuthInstance,
  emailHandlers: EmailHandlers,
  app?: Readonly<App>
): Readonly<Hono> => {
  // `app.auth` is the single source of the invitation flow's auth config; the
  // factories below take it directly, so derive it once instead of threading a
  // redundant `authConfig` parameter alongside `app`.
  const authConfig = app?.auth
  const inviteHandler = createInviteUserHandler(authInstance, authConfig, emailHandlers, app)
  const acceptApiHandler = createAcceptInvitationHandler(authInstance, authConfig)
  const appWithApiRoutes = chainAdminInvitationLifecycleRoutes(
    honoApp
      .post('/api/auth/admin/invite-user', inviteHandler)
      .post('/api/auth/admin/accept-invitation', acceptApiHandler),
    { authInstance, emailHandlers, resolveBaseURL, app }
  )

  // Skip the built-in HTML page when the app supplies a custom page at the
  // same path — the user-defined page (with its own branding) takes priority.
  const hasCustomAcceptPage =
    app?.pages?.some((page) => page.path === '/accept-invitation') ?? false
  if (hasCustomAcceptPage) {
    return appWithApiRoutes
  }

  const acceptPageHandler = createAcceptInvitationPageHandler(authConfig)
  return appWithApiRoutes.get('/accept-invitation', acceptPageHandler)
}
