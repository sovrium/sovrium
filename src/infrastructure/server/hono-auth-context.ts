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

import { Context } from 'effect'
import { buildEffectiveRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { resolveTrustedForwardedIp } from '@/domain/kernel/url/client-ip'
import { isAdminEquivalent } from '@/domain/models/app'
import { toGrantingRole } from '@/domain/models/app/auth/roles/granting-role-service'
import { isSessionBindingValid } from '@/domain/models/app/auth/session-binding-validation'
import { hasSessionCookie } from '@/domain/models/app/auth/session-cookie'
import { resolveTrustedProxyHops } from '@/domain/models/process-env/proxy'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { logWarning } from '@/infrastructure/logging/logger'
import { runOnDomain } from '@/infrastructure/server/domain-runtime'
import { makeAuthHookPolicies } from './auth-hook-policies'
import type { SessionCookie } from '@/application/ports/contracts/hono-app-config'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { AuthRuntime } from '@/infrastructure/auth/better-auth/server-runtime'
import type { DomainContext } from '@/infrastructure/server/domain-runtime'

/**
 * The operator's declared proxy hop count, decoded once per server.
 *
 * An invalid `TRUSTED_PROXY_HOPS` degrades to the safe default rather than
 * failing every page render — the same fallback, for the same reason, as the
 * API's own reader (`presentation/api/middleware/client-ip.ts`), which logs
 * the cause.
 */
const decodeTrustedProxyHops = (): number => resolveTrustedProxyHops(process.env)

/**
 * Whether the session this request carries was issued to this client.
 *
 * The page tier and the API must agree on who is signed in. `authMiddleware`
 * refuses a session presented from another IP or User-Agent, so this reader
 * does too — otherwise a page (the mounted console included) would render,
 * server-side, for a replayed cookie its own API answers 401. The request side
 * is derived exactly as the API derives it: the User-Agent header, and the
 * address a TRUSTED proxy vouched for, never the transport peer.
 */
const isBoundToThisClient = (
  session: {
    readonly id: string
    readonly ipAddress?: string | null
    readonly userAgent?: string | null
  },
  headers: Headers,
  trustedProxyHops: number
): boolean => {
  const current = {
    ipAddress: resolveTrustedForwardedIp({
      forwardedFor: headers.get('x-forwarded-for') ?? undefined,
      realIp: headers.get('x-real-ip') ?? undefined,
      cfConnectingIp: headers.get('cf-connecting-ip') ?? undefined,
      trustedProxyHops,
    }),
    userAgent: headers.get('user-agent') ?? undefined,
  }
  if (isSessionBindingValid(session, current)) return true
  logWarning(`[AUTH] Page session binding validation failed for session ${session.id}`)
  return false
}

/** The `signInMethod` a session row carries (a Better Auth additional field), when any. */
const signInMethodOf = (session: object): string | undefined => {
  const value = (session as { readonly signInMethod?: unknown }).signInMethod
  return typeof value === 'string' && value !== '' ? value : undefined
}

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>

/** Whether the instance keeps an account cookie (an option this engine's own config leaves out). */
const storesAccountCookie = (options: object): boolean =>
  (options as { readonly account?: { readonly storeAccountCookie?: boolean } }).account
    ?.storeAccountCookie === true

/**
 * The cookies signing out expires, read off the auth instance's own cookie
 * configuration — names (with the `__Secure-` prefix on a secure bind) and
 * attributes alike — so a refused session is cleared exactly as sign-out
 * clears it.
 */
const signOutCookiesOf = async (
  authInstance: AuthInstance
): Promise<{ readonly cookies: readonly SessionCookie[]; readonly sessionData: SessionCookie }> => {
  const context = await authInstance.$context
  const { sessionToken, sessionData, accountData, dontRememberToken } = context.authCookies
  const cookies = [
    sessionToken,
    sessionData,
    ...(storesAccountCookie(context.options) ? [accountData] : []),
    ...(context.oauthConfig.storeStateStrategy === 'cookie'
      ? [context.createAuthCookie('oauth_state')]
      : []),
    dontRememberToken,
  ]
  const toSessionCookie = ({ name, attributes }: typeof sessionToken): SessionCookie => ({
    name,
    attributes: {
      path: attributes.path,
      domain: attributes.domain,
      secure: attributes.secure,
      httpOnly: attributes.httpOnly,
      sameSite: attributes.sameSite,
      partitioned: attributes.partitioned,
    },
  })
  return { cookies: cookies.map(toSessionCookie), sessionData: toSessionCookie(sessionData) }
}

/** The names of the cookies a `Cookie` header carries. */
const cookieNamesIn = (cookieHeader: string | null): readonly string[] =>
  (cookieHeader ?? '').split(';').flatMap((pair) => {
    const separator = pair.indexOf('=')
    return separator === -1 ? [] : [pair.slice(0, separator).trim()]
  })

/**
 * The session cookies to expire for each request whose session the page tier
 * refused or found ended, keyed by the request's own headers: the reader marks
 * the request as it answers it, and the page route reads the mark before it
 * redirects.
 */
const buildEndedSession = (
  signOut: Awaited<ReturnType<typeof signOutCookiesOf>>,
  ended: WeakSet<Headers>
): ((headers: Headers) => readonly SessionCookie[] | undefined) => {
  const { cookies, sessionData } = signOut
  return (headers) => {
    if (!ended.has(headers)) return undefined
    // A large cookie cache is split into numbered chunks; sign-out clears those too.
    const chunks = cookieNamesIn(headers.get('cookie'))
      .filter((name) => name.startsWith(`${sessionData.name}.`))
      .map((name) => ({ name, attributes: sessionData.attributes }))
    return [...cookies, ...chunks]
  }
}

/**
 * The session this request may hold, or `undefined`.
 *
 * A request carrying a session cookie that names no live session, or a session
 * this client may not hold, is answered as anonymous AND recorded in `ended`,
 * so the page route can expire its cookies and tell the sign-in page.
 */
const readBoundSession = async (
  authInstance: AuthInstance,
  headers: Headers,
  trustedProxyHops: number,
  ended: WeakSet<Headers>
) => {
  const session = await authInstance.api.getSession({ headers })
  const refused = session
    ? !isBoundToThisClient(session.session, headers, trustedProxyHops)
    : hasSessionCookie(headers.get('cookie') ?? undefined)
  if (refused) ended.add(headers)
  return refused ? undefined : (session ?? undefined)
}

/**
 * Builds a getSession callback from an auth instance for page access control
 */
function buildGetSession(
  authInstance: AuthInstance,
  app: Readonly<App>,
  domainContext: DomainContext,
  ended: WeakSet<Headers>
): (headers: Headers) => Promise<SessionInfo | undefined> {
  const trustedProxyHops = decodeTrustedProxyHops()
  return async (headers) => {
    try {
      const session = await readBoundSession(authInstance, headers, trustedProxyHops, ended)
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
        notifyAutomationAlerts?: boolean
        notifyWeeklyDigest?: boolean
        twoFactorEnabled?: boolean | null
      }
      // An absent, empty or undeclared stored role grants nothing — never the
      // `member` default (the records API judges it the same way).
      const role = toGrantingRole(user.role, app)
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
      // downstream consumer (`checkPageAccess`, …) sees the same set the table-level row-level guard uses — closing
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
        // The two operator-email preferences, `NOT NULL DEFAULT true`. An absent
        // key (an envelope composed before the columns existed) is left absent
        // rather than guessed.
        ...(typeof user.notifyAutomationAlerts === 'boolean'
          ? { notifyAutomationAlerts: user.notifyAutomationAlerts }
          : {}),
        ...(typeof user.notifyWeeklyDigest === 'boolean'
          ? { notifyWeeklyDigest: user.notifyWeeklyDigest }
          : {}),
        // The two-step switch, on an app that configures it: a column never
        // written (NULL) reads `false`, so a condition compared with `false`
        // admits a reader who never enrolled.
        ...(app.auth?.twoFactor ? { twoFactorEnabled: user.twoFactorEnabled === true } : {}),
        isUnrestricted,
        groups,
        effectiveRoles,
        ...(signInMethodOf(session.session) === undefined
          ? {}
          : { signInMethod: signInMethodOf(session.session) }),
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
  readonly endedSession: ((headers: Headers) => readonly SessionCookie[] | undefined) | undefined
}> => {
  if (!app.auth) {
    return {
      runtime: undefined,
      authInstance: undefined,
      getSession: undefined,
      endedSession: undefined,
    }
  }

  const runtime = await import('@/infrastructure/auth/better-auth/server-runtime')
  // Create auth instance once — shared between auth routes and page session extraction.
  const database = Context.get(domainContext, Database)
  const authInstance = runtime.createAuthInstance(app.auth, {
    policies: makeAuthHookPolicies(database, domainContext),
    appMeta: app,
    domainContext,
    database,
  })

  const ended = new WeakSet<Headers>()
  return {
    runtime,
    authInstance,
    getSession: buildGetSession(authInstance, app, domainContext, ended),
    endedSession: buildEndedSession(await signOutCookiesOf(authInstance), ended),
  }
}
