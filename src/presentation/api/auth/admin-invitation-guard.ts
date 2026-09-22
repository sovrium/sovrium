/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two helpers every admin invitation route shares: the authorization guard
 * and the accept-link base URL.
 *
 * Extracted into their own module so the issue/accept routes and the
 * lifecycle (list/resend/revoke) routes can both reach them WITHOUT importing
 * each other — the two route modules would otherwise form an import cycle.
 * Keeping the guards in one place is the point: every endpoint on the invitation
 * surface must DENY identically, or the ones that deny differently become the
 * probe that reveals the rest.
 *
 * There are two guards, and the difference between them is what they ADMIT, never
 * how they refuse:
 *
 *   - {@link requireAdminCaller} — admin-equivalent only. Guards the lifecycle
 *     endpoints (list / resend / revoke), which enumerate the whole app's
 *     invitations and so must stay closed to a tenant-scoped caller.
 *   - {@link requireInviteCaller} — admin-equivalent OR a role holding the
 *     `auth.roles[].canInvite` grant, bounded by the invited role's level.
 *     Guards issuing an invitation, and nothing else.
 *
 * Both refuse with the same 404 body ({@link denyNotFound}) and the same 401 for
 * an anonymous caller, so the widening changes who gets in without changing what
 * a refused caller can learn.
 */

import { getUserRole } from '@/application/use-cases/tables/user-role'
import { canInviteRole, isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import type { App } from '@/domain/models/app'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { Context } from 'hono'

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>

export interface SessionLike {
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

export const resolveBaseURL = (c: Context): string => {
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
 * Resolve the admin caller's session and verify their role is admin-EQUIVALENT
 * for this app (`isAdminEquivalent`: the resolved top role ∪ the built-in
 * `admin`) — the same predicate `applyAdminRoleCheckMiddleware` applies to the
 * rest of `/api/auth/admin/*`. Reading the strict literal `role === 'admin'`
 * here 404ed (via that middleware) the very operator an app designated.
 *
 * The denial is **404**, never 403. The previous 403 was unreachable only
 * because the middleware 404ed first; the moment that middleware widened, a 403
 * from here would have confirmed the endpoint's existence to every
 * non-admin-equivalent caller — an S1 anti-enumeration regression introduced BY
 * the alignment. Both guards move together, and both deny identically.
 *
 * Guards the invitation LIFECYCLE endpoints. Issuing an invitation moved to
 * {@link requireInviteCaller}; this one deliberately did not widen with it,
 * because list / resend / revoke range over every invitation in the app and a
 * tenant-scoped caller must not read another tenant's invitees.
 *
 * Returns the JSON Response when authorization fails (401 anonymous / 404
 * non-admin). Returns the authenticated session when successful so the handler
 * has access to the inviter's display name.
 */
export const requireAdminCaller = async (
  authInstance: AuthInstance,

  c: Context,
  app: Readonly<App> | undefined
): Promise<{ readonly session: SessionLike } | Response> => {
  const caller = await resolveCaller(authInstance, c)
  if (caller instanceof Response) return caller
  if (!isAdminEquivalent(caller.role, app ?? {})) return denyNotFound(c)
  return { session: caller.session }
}

/**
 * The 404 every denial on this surface answers with — never 403.
 *
 * Shared so the admin guard and the invite guard are byte-identical in refusal.
 * Two guards that denied differently would themselves be the oracle: a caller
 * could tell "I lack the invite grant" from "this endpoint is not for me", which
 * is precisely the distinction S1 anti-enumeration exists to withhold.
 */
const denyNotFound = (c: Context): Response =>
  c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)

/**
 * Resolve the caller's session and stored role, or the refusal that replaces
 * them: 401 with no session at all, 404 for a session whose user carries no
 * resolvable role.
 *
 * Extracted so both guards below share ONE authentication path. They differ only
 * in the authorization predicate they then apply.
 */
const resolveCaller = async (
  authInstance: AuthInstance,

  c: Context
): Promise<{ readonly session: SessionLike; readonly role: string } | Response> => {
  const callerSession = (await authInstance.api.getSession({
    headers: c.req.raw.headers,
  })) as SessionLike | null

  if (!callerSession) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const role = await runDomainPromise(c, getUserRole(callerSession.session.userId))
  if (role === undefined) return denyNotFound(c)

  return { session: callerSession, role }
}

/**
 * The authorization gate for `POST /api/auth/admin/invite-user` specifically:
 * admin-equivalent as before, OR a role declaring `canInvite` and inviting at or
 * below its own level ({@link canInviteRole}).
 *
 * DELIBERATELY NOT `requireAdminCaller`, and the two must not be merged. The
 * ceiling that makes the grant safe is a comparison against the INVITED role,
 * which exists only on this endpoint's request body — list, resend and revoke
 * name no role at all, so there is nothing there to bound a granted caller
 * against. Widening the shared guard would hand a tenant-scoped inviter every
 * outstanding invitation in the app, including other tenants' invitees: the
 * cross-tenant read the grant explicitly does not confer.
 *
 * The resulting asymmetry — 200 on invite, 404 on list, for the same caller — is
 * not an enumeration leak. A caller who has just been served a 200 already knows
 * the invitation surface exists; what the 404 withholds from them is other
 * tenants' data, not the existence of a route.
 *
 * Returns the caller's role alongside the session because the invitation flow
 * needs it downstream: an inviter who is not admin-equivalent is a scoped
 * inviter, and their assignments are what the invitee inherits.
 */
export const requireInviteCaller = async (
  authInstance: AuthInstance,

  c: Context,
  app: Readonly<App> | undefined,
  invitedRole: string | undefined
): Promise<{ readonly session: SessionLike; readonly role: string } | Response> => {
  const caller = await resolveCaller(authInstance, c)
  if (caller instanceof Response) return caller
  if (!canInviteRole(caller.role, invitedRole, app ?? {})) return denyNotFound(c)
  return caller
}
