/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createAuthMiddleware, isAPIError } from 'better-auth/api'
/* eslint-disable boundaries/dependencies -- Better Auth's hooks are the only point that observes a sign-in, a sign-out or a reset; the application use case is the dispatch contract, same shape as the record-event trigger bridge. */
import {
  triggerAuthEventAutomations,
  type AuthTriggerEvent,
} from '@/application/use-cases/automations/trigger-auth-event'
/* eslint-enable boundaries/dependencies -- end of the dispatch-contract import */
import { logError } from '@/infrastructure/logging/logger'
import { runOnDomain } from '@/infrastructure/server/domain-runtime'
import { requestKey, type AuthMiddlewareCtx } from './hook-context'
import type { AuthHookContext } from './auth-database-hooks'
import type { App } from '@/domain/models/app'
import type { BetterAuthPlugin } from 'better-auth'

/**
 * The auth events an `auth` automation trigger subscribes to, dispatched from
 * the Better Auth hooks that can see them.
 *
 * - `signUp` and `emailVerified` come from the database hooks (a user row is
 *   created; an update sets `emailVerified`).
 * - `signIn` and `signOut` come from request hooks here, because only the
 *   REQUEST says why a session was opened or deleted: the sign-up form, a
 *   revocation, a ban and an expired session all touch sessions too, and none
 *   of them is a person signing in or out.
 * - `passwordReset` comes from Better Auth's `onPasswordReset`, which every
 *   reset way calls once the new password is stored.
 *
 * Every event hands its automations `{ event, user }` and nothing else: never
 * the session, a link token or a password. The run history keeps the trigger
 * data, and reading a run must not let anyone sign in as the person it names.
 */

/**
 * Drive the `triggerAuthEventAutomations` use case from a plain-async Better
 * Auth hook. A crashing automation never fails the auth flow it observes: the
 * use case absorbs its own errors, and a rejection of the run itself is logged
 * with its cause and swallowed here.
 *
 * No app (the OpenAPI-schema instance) or no server context means no
 * automation runtime to reach, so the bridge does nothing.
 */
export const dispatchAuthEvent = (
  event: AuthTriggerEvent,
  user: Readonly<Record<string, unknown>>,
  hookContext: AuthHookContext | undefined
): Promise<void> => {
  const appMeta = hookContext?.appMeta
  const domainContext = hookContext?.domainContext
  if (!appMeta?.automations || appMeta.automations.length === 0) return Promise.resolve()
  if (domainContext === undefined) return Promise.resolve()
  const program = triggerAuthEventAutomations({
    app: appMeta as App,
    event,
    user,
    processEnv: process.env,
    userId: typeof user['id'] === 'string' ? (user['id'] as string) : undefined,
  })
  // Swallowed on purpose: an automation must never fail the sign-in, sign-out
  // or reset it reacts to. The cause is logged for the operator.
  return runOnDomain(domainContext, program).catch((err) => {
    logError('[automation:auth-event] auth-event dispatch failed', err)
  })
}

/** The endpoints that sign a person in when they open a session. */
const SIGN_IN_PATHS: ReadonlySet<string> = new Set([
  '/sign-in/email',
  '/sign-in/username',
  '/sign-in/email-otp',
  '/sign-in/phone-number',
  '/sign-in/social',
  '/magic-link/verify',
  '/passkey/verify-authentication',
  '/two-factor/verify-totp',
  '/two-factor/verify-otp',
  '/two-factor/verify-backup-code',
  '/sso/callback',
])

/** The provider callbacks, whose path carries the provider id. */
const SIGN_IN_PREFIXES: readonly string[] = [
  '/callback/',
  '/oauth2/callback/',
  '/sso/callback/',
  '/sso/saml2/callback/',
  '/sso/saml2/sp/acs/',
]

/**
 * `true` when the endpoint at `path` is a way of signing in.
 *
 * Opening a session is not enough: the sign-up form opens one, so does a
 * verified address with auto sign-in, an impersonation, a password change that
 * re-issues the session. And asking for a magic link or starting a single
 * sign-on flow is a sign-in way that opens NO session yet — the `newSession`
 * check in {@link signedInUser} leaves those out.
 */
export const isSignInPath = (path: string | undefined): boolean =>
  path !== undefined &&
  (SIGN_IN_PATHS.has(path) || SIGN_IN_PREFIXES.some((prefix) => path.startsWith(prefix)))

/** `true` unless the endpoint was refused (a redirect is not a refusal). */
const notRefused = (returned: unknown): boolean => {
  if (isAPIError(returned)) return returned.statusCode < 400
  return !(returned instanceof Response) || returned.status < 400
}

/** The account each sign-out request is ending, read before the session is deleted. */
const signingOut = new WeakMap<object, Readonly<Record<string, unknown>>>()

/**
 * Read the account a `/sign-out` request belongs to, while its session still
 * exists. Only a live session counts: signing out with no cookie, a session
 * already ended or an expired one signs no one out. A failed read is logged and
 * ignored — it never fails the sign-out.
 */
const captureSignOut = async (ctx: AuthMiddlewareCtx): Promise<void> => {
  const key = requestKey(ctx)
  if (key === undefined) return
  try {
    const token = await ctx.getSignedCookie(
      ctx.context.authCookies.sessionToken.name,
      ctx.context.secret
    )
    if (!token) return
    const found = await ctx.context.internalAdapter.findSession(token)
    if (!found || new Date(found.session.expiresAt).getTime() <= Date.now()) return
    signingOut.set(key, found.user as Readonly<Record<string, unknown>>)
  } catch (err) {
    logError('[automation:auth-event] could not read the session being signed out', err)
  }
}

/** The `before` half: remember who is signing out. */
export const applyAuthEventBeforeHooks = async (ctx: AuthMiddlewareCtx): Promise<void> => {
  if (ctx.path === '/sign-out') await captureSignOut(ctx)
}

/**
 * The account a sign-in way signed in, read once every hook has had its say —
 * `undefined` when the request opened no session, or was refused.
 *
 * Read LAST because a later hook may take the session back: the two-factor
 * plugin deletes the session a password opened for an account with a second
 * factor and asks for the code instead. That person has not signed in yet, and
 * signs in when the code is checked, on its own sign-in way.
 */
export const signedInUser = (
  ctx: AuthMiddlewareCtx
): Readonly<Record<string, unknown>> | undefined => {
  const { returned, newSession } = ctx.context as {
    readonly returned?: unknown
    readonly newSession?: { readonly user?: Readonly<Record<string, unknown>> } | null
  }
  return isSignInPath(ctx.path) && newSession?.user && notRefused(returned)
    ? newSession.user
    : undefined
}

/**
 * The plugin firing `signIn`. A plugin rather than one more line of the app's
 * `after` hook because Better Auth runs the app's hook BEFORE every plugin's:
 * there, a password sign-in still holds the session the two-factor plugin is
 * about to delete, and `signIn` would fire for a person who has only given a
 * password — then fire again when they give the code. Registered after every
 * other plugin, its hook reads the session the request actually kept.
 */
export const buildAuthEventPlugin = (hookContext: AuthHookContext | undefined) =>
  ({
    id: 'sovrium-auth-events',
    hooks: {
      after: [
        {
          matcher: (ctx: { readonly path?: string }) => isSignInPath(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            const user = signedInUser(ctx)
            if (user !== undefined) await dispatchAuthEvent('signIn', user, hookContext)
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin

/**
 * The `after` half of the app's hook: fire `signOut` when a sign-out ended the
 * session read before it. Awaited, so an automation's effect is visible once
 * the response is; never throws. (`signIn` is the plugin's, above.)
 */
export const applyAuthEventAfterHooks = async (
  ctx: AuthMiddlewareCtx,
  hookContext: AuthHookContext | undefined
): Promise<void> => {
  if (ctx.path !== '/sign-out') return
  const key = requestKey(ctx)
  const user = key === undefined ? undefined : signingOut.get(key)
  if (key !== undefined) signingOut.delete(key)
  if (user !== undefined && notRefused(ctx.context.returned)) {
    await dispatchAuthEvent('signOut', user, hookContext)
  }
}

/**
 * Better Auth's `onPasswordReset`: called by every reset way once the new
 * password is stored, and only then — a refused or forged link never reaches
 * it. It hands the account; the token and the new password stay behind.
 */
export const passwordResetDispatcher =
  (hookContext: AuthHookContext | undefined) =>
  async ({ user }: { readonly user: Readonly<Record<string, unknown>> }): Promise<void> => {
    await dispatchAuthEvent('passwordReset', user, hookContext)
  }

/**
 * The update requests that are verifying an address, keyed by the endpoint
 * context Better Auth hands both halves of one update. Counted, because one
 * request may run more than one update. An update outside any endpoint has no
 * request to key on and fires nothing: a shared key there would let one
 * update's mark be spent by another's, naming the wrong account.
 */
const verifying = new WeakMap<object, number>()

const updateKey = (context: unknown): object | undefined =>
  typeof context === 'object' && context !== null ? context : undefined

/**
 * `true` when the update names an account whose address is ALREADY verified —
 * an administrator writing `emailVerified: true` over a verified account
 * verifies nothing. Only an update naming its account in the body (the admin
 * `update-user`) is read: Better Auth's own verification ways write the flag
 * only to an unverified account.
 */
const alreadyVerified = async (context: object): Promise<boolean> => {
  const endpoint = context as {
    readonly body?: { readonly userId?: unknown }
    readonly context?: {
      readonly internalAdapter?: {
        readonly findUserById: (id: string) => Promise<{ readonly emailVerified?: unknown } | null>
      }
    }
  }
  const userId = endpoint.body?.userId
  const adapter = endpoint.context?.internalAdapter
  if (typeof userId !== 'string' || adapter === undefined) return false
  const current = await adapter.findUserById(userId).catch(() => null)
  return current?.emailVerified === true
}

/**
 * The `user.update` database hooks firing `emailVerified` when an update makes
 * the address verified, and only then. The after hook sees only the resulting
 * row, which reads `emailVerified: true` on every later update of a verified
 * account too (a rename), so the before hook remembers the updates that turn
 * `emailVerified` from false to true and the after hook fires for those alone.
 */
export const emailVerifiedHooks = (hookContext: AuthHookContext | undefined) => ({
  before: async (data: Readonly<Record<string, unknown>>, context: unknown): Promise<void> => {
    if (data['emailVerified'] !== true) return
    const key = updateKey(context)
    if (key === undefined || (await alreadyVerified(key))) return
    verifying.set(key, (verifying.get(key) ?? 0) + 1)
  },
  after: async (user: Readonly<Record<string, unknown>> | null, context: unknown) => {
    const key = updateKey(context)
    const pending = key === undefined ? 0 : (verifying.get(key) ?? 0)
    if (key === undefined || pending === 0) return
    if (pending === 1) verifying.delete(key)
    else verifying.set(key, pending - 1)
    // `null` when the update matched no row (the admin `set-role` endpoint on
    // an unknown user is idempotent and answers 200): nothing was verified.
    if (user !== null && user['emailVerified'] === true) {
      await dispatchAuthEvent('emailVerified', user, hookContext)
    }
  },
})
