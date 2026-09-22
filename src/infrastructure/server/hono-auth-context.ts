/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Auth resolution for the Hono application.
 *
 * `createHonoApp` needs three things from an auth-enabled config — the loaded
 * Better Auth runtime, the instance it built, and a `getSession` callback page
 * access control can call. Resolving them is a self-contained step with no
 * route knowledge, so it lives beside the composition root rather than inside
 * it.
 */

import { buildEffectiveRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { isAdminEquivalent } from '@/domain/models/app'
import { runOnDomain } from '@/infrastructure/server/domain-runtime'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { AuthRuntime } from '@/infrastructure/auth/better-auth/server-runtime'
import type { DomainContext } from '@/infrastructure/server/domain-runtime'

/**
 * Builds a getSession callback from an auth instance for page access control
 */
function buildGetSession(
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  app: Readonly<App>,
  domainContext: DomainContext
): (headers: Headers) => Promise<SessionInfo | undefined> {
  return async (headers) => {
    try {
      const session = await authInstance.api.getSession({ headers })
      if (!session) return undefined
      // Admin plugin adds `role` to user at runtime (not in base type), and
      // `language` is an `additionalFields` column, absent from it for the same
      // reason. Both are widened here.
      const user = session.user as {
        id: string
        email?: string
        name?: string
        role?: string
        language?: string | null
      }
      const role = user.role ?? 'member'
      // Better Auth admin plugin grants global, unrestricted access to the
      // app's admin-equivalent role. The Z-1 `$currentUser.isUnrestricted`
      // flag mirrors that — Z-1.
      // `isAdminEquivalent` resolves the highest-`level` custom role (e.g.
      // cloud `operator`, partner `engineer`) and still honors built-in
      // `admin`, so custom-role apps no longer bounce their superuser to
      // `/no-access` (WI-5).
      const isUnrestricted = isAdminEquivalent(role, app)
      // Sovrium group memberships — drives group-based page access.
      const groups = await runOnDomain(domainContext, getUserGroups(user.id))
      // Effective roles = global Better Auth role + `group:<name>` overlay for
      // every group the user belongs to. Stamped at hydration time so every
      // downstream consumer (`checkPageAccess`, `isSharedViewAccessDenied`,
      // …) sees the same set the table-level row-level guard uses — closing
      // the single-role-vs-effective-roles asymmetry called out in Phase 8.
      const effectiveRoles = buildEffectiveRoles(role, groups)
      return {
        userId: user.id,
        role,
        email: user.email,
        name: user.name,
        // Carried RAW. A person's stored preference is resolved against the
        // languages of whichever app is being rendered, never here — see
        // `SessionInfo.language`. The column is nullable, so a stored NULL, an
        // empty string and a column never written all collapse to the same
        // absence: none of them is a language anyone chose.
        ...(user.language ? { language: user.language } : {}),
        isUnrestricted,
        groups,
        effectiveRoles,
      }
    } catch {
      return undefined
    }
  }
}

/**
 * Everything `createHonoApp` needs from Better Auth, resolved together.
 *
 * The three travel as a unit — the runtime is what BUILDS the instance, and the
 * session reader is a closure over it — so resolving them in one helper keeps
 * `createHonoApp` inside its statement budget and makes the all-or-nothing
 * invariant explicit: either `app.auth` is set and all three are present, or
 * none of them are.
 *
 * THE lazy boundary lives here. `server-runtime` is the only module outside
 * `infrastructure/auth/better-auth/` that names the Better Auth package as a
 * value, and it is loaded at BOOT — before the listener binds — only when the
 * app declares `auth:`. An app without auth never loads the package at all
 * (measured: 328 package modules → 0); an app with auth has the whole graph
 * resident before its first request, so nothing pays an import mid-flight.
 */
export const resolveAuthContext = async (
  app: Readonly<App>,
  domainContext: DomainContext
): Promise<{
  readonly runtime: AuthRuntime | undefined
  readonly authInstance: Readonly<ReturnType<typeof createAuthInstance>> | undefined
  readonly getSession: ((headers: Headers) => Promise<SessionInfo | undefined>) | undefined
}> => {
  if (!app.auth) return { runtime: undefined, authInstance: undefined, getSession: undefined }

  const runtime = await import('@/infrastructure/auth/better-auth/server-runtime')
  // Create auth instance once — shared between auth routes and page session extraction.
  // `app.connections` is forwarded to the user-create databaseHook so the
  // test-mode token seeder (no-op in production) can auto-populate
  // `system.connection_tokens` for newly registered users without
  // requiring each spec to drive the real OAuth round-trip.
  const authInstance = runtime.createAuthInstance(app.auth, app.connections, app, domainContext)

  return { runtime, authInstance, getSession: buildGetSession(authInstance, app, domainContext) }
}
