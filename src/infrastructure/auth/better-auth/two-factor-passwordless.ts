/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createAuthMiddleware } from 'better-auth/api'
import { loginPageOf } from '@/domain/models/app/auth/login-page-service'
import type { AuthMiddlewareCtx } from './hook-context'
import type { Auth } from '@/domain/models/app/auth'
import type { BetterAuthPlugin } from 'better-auth'

/**
 * The second sign-in step for the sign-ins that need no password.
 *
 * Better Auth's two-factor plugin holds back the session of a PASSWORD sign-in
 * (`/sign-in/email`, `/sign-in/username`, `/sign-in/phone-number`) when the
 * account turned two-step on, and nothing else: a sign-in link, a sign-in code,
 * or the automatic sign-in after an address verified by code opened a full
 * session past the second step. The roads below now run the plugin's own
 * `after` hook, unchanged — the same trusted-device check, the same deleted
 * session, the same `two_factor` cookie and attempt rows, the same
 * `{ twoFactorRedirect, twoFactorMethods }` answer — so they end exactly where
 * a password ends.
 */

/** The roads that open a session without a password, as Better Auth names them. */
export const PASSWORDLESS_SIGN_IN_PATHS: ReadonlySet<string> = new Set([
  '/magic-link/verify',
  '/sign-in/email-otp',
  '/email-otp/verify-email',
])

/** One `after` hook of a Better Auth plugin. */
interface AfterHook {
  readonly matcher: (ctx: never) => boolean
  readonly handler: (...args: never[]) => unknown
}

/** The slice of the two-factor plugin this module reuses: its `after` hook. */
export interface TwoFactorAfterHooks {
  readonly hooks: { readonly after: readonly AfterHook[] }
}

/** `true` when an `after` hook's `returned` value is the "a code is owed" answer. */
export const owesSecondStep = (returned: unknown): boolean =>
  typeof returned === 'object' &&
  returned !== null &&
  (returned as { readonly twoFactorRedirect?: unknown }).twoFactorRedirect === true

/**
 * A followed sign-in link answers with a redirect to where it was headed. When
 * the account still owes its code, that page would open signed out, so the
 * redirect goes to the app's sign-in page instead, the sign-in waiting in its
 * cookie: a `verifyTwoFactor` form there finishes it, and the destination the
 * link was headed to is kept beside the waiting sign-in
 * (`two-factor-destination.ts`). A link opened without a destination answered
 * JSON and is left as the plugin answered it.
 */
const redirectToSecondStep = (loginPage: string) =>
  createAuthMiddleware(async (ctx: AuthMiddlewareCtx) => {
    if (!owesSecondStep(ctx.context.returned)) return
    const headers = (ctx.context as { readonly responseHeaders?: Headers }).responseHeaders
    if (headers?.has('location') !== true) return
    ctx.setHeader('location', new URL(loginPage, ctx.context.baseURL).toString())
  })

/**
 * The plugin putting the passwordless sign-ins behind the second step. Takes
 * the two-factor plugin it extends and reuses that plugin's own `after`
 * handler, so the check is the library's and follows its upgrades. Register it
 * right after that plugin and before `buildTwoFactorDestinationPlugin`, whose
 * hook reads the attempt cookie this one sets.
 *
 * Throws when that plugin has no `after` hook on a password sign-in: building
 * the server without it would let a link or a code open a full session past
 * the second step, so the server refuses to start instead.
 */
export const buildPasswordlessTwoFactorPlugin = (
  twoFactor: TwoFactorAfterHooks,
  authConfig: Auth | undefined
) => {
  // The plugin's hook on a password sign-in: the one this module reruns.
  const signInHook = twoFactor.hooks.after.find((hook) =>
    (hook.matcher as (ctx: { readonly path: string }) => boolean)({ path: '/sign-in/email' })
  )
  if (signInHook === undefined) {
    throw new Error(
      "Sovrium's passwordless two-factor plugin found no `after` hook matching '/sign-in/email' in Better Auth's two-factor plugin; sign-ins by link or code cannot be held behind the second step, so the server refuses to start"
    )
  }
  return [
    {
      id: 'sovrium-passwordless-two-factor',
      hooks: {
        after: [
          {
            matcher: (ctx: { readonly path?: string }) =>
              PASSWORDLESS_SIGN_IN_PATHS.has(ctx.path ?? ''),
            handler: signInHook.handler as ReturnType<typeof createAuthMiddleware>,
          },
          {
            matcher: (ctx: { readonly path?: string }) => ctx.path === '/magic-link/verify',
            handler: redirectToSecondStep(loginPageOf(authConfig)),
          },
        ],
      },
    } satisfies BetterAuthPlugin,
  ]
}
