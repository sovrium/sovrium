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
import { resolvePasswordPolicy } from '@/domain/utils/auth/password-policy'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
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
    }
  }

  const host = c.req.header('host') ?? 'localhost'
  const proto = c.req.header('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

const requireAdminCaller = async (
  authInstance: AuthInstance,
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

const createInviteUserHandler =
  (authInstance: AuthInstance, authConfig: Auth | undefined, emailHandlers: EmailHandlers) =>
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

const createAcceptInvitationHandler =
  (authInstance: AuthInstance, authConfig: Auth | undefined) =>
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

const createAcceptInvitationPageHandler =
  (authConfig: Auth | undefined) =>
  async (c: Context) => {
    const token = c.req.query('token') ?? ''
    const { minLength } = resolvePasswordPolicy(authConfig)
    const html = renderAcceptInvitationPage(token, minLength)
    return c.html(html, 200)
  }

export const chainAdminInvitationRoutes = (
  honoApp: Readonly<Hono>,
  authInstance: AuthInstance,
  emailHandlers: EmailHandlers,
  app?: Readonly<App>
): Readonly<Hono> => {
  const authConfig = app?.auth
  const inviteHandler = createInviteUserHandler(authInstance, authConfig, emailHandlers)
  const acceptApiHandler = createAcceptInvitationHandler(authInstance, authConfig)
  const appWithApiRoutes = honoApp
    .post('/api/auth/admin/invite-user', inviteHandler)
    .post('/api/auth/admin/accept-invitation', acceptApiHandler)

  const hasCustomAcceptPage =
    app?.pages?.some((page) => page.path === '/accept-invitation') ?? false
  if (hasCustomAcceptPage) {
    return appWithApiRoutes
  }

  const acceptPageHandler = createAcceptInvitationPageHandler(authConfig)
  return appWithApiRoutes.get('/accept-invitation', acceptPageHandler)
}
