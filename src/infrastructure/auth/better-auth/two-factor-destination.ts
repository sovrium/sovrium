/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createAuthMiddleware } from 'better-auth/api'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { logError } from '@/infrastructure/logging/logger'
import { destinationIdentifier, TWO_FACTOR_COOKIE } from './two-factor-attempt-keys'
import type { AuthMiddlewareCtx } from './hook-context'
import type { BetterAuthPlugin } from 'better-auth'

/**
 * Where a password sign-in was headed, kept beside the attempt that still owes
 * its second step — so the code page, a different page, sends the reader on to
 * that destination once the code is right.
 *
 * Better Auth's two-factor plugin answers a password that owes a code by
 * storing the attempt as a `verification` row `2fa-<random>` and handing the
 * browser that identifier in the signed `two_factor` cookie. The sign-in form
 * sends where it was headed as the body's `callbackURL`; this hook, once that
 * row exists, writes a sibling row `2fa-destination-<random>` with the same
 * lifetime. The code page reads it through the same signed cookie when it
 * renders (`two-factor-attempt-reader.ts`), and never from its own address —
 * a crafted link to the code page cannot choose where the reader lands.
 */

/**
 * The attempt identifier the two-factor plugin just handed the browser, read
 * from the `Set-Cookie` it added to this response — `undefined` when the
 * request started no attempt (a password that owes no code, or a refusal).
 *
 * The cookie's value is `<identifier>.<signature>`, URL-encoded; the identifier
 * holds no dot, so it is everything before the last one.
 */
export const attemptIdFromSetCookie = (
  setCookies: readonly string[],
  cookieName: string
): string | undefined => {
  const prefix = `${cookieName}=`
  const cookie = setCookies.find((line) => line.startsWith(prefix))
  if (cookie === undefined) return undefined
  const raw = cookie.slice(prefix.length).split(';')[0] ?? ''
  const value = decodeURIComponent(raw)
  const dot = value.lastIndexOf('.')
  const id = dot > 0 ? value.slice(0, dot) : ''
  return id.startsWith('2fa-') ? id : undefined
}

/** The `Set-Cookie` lines the response holds so far. */
const setCookiesOf = (ctx: AuthMiddlewareCtx): readonly string[] => {
  const headers = (ctx.context as { readonly responseHeaders?: Headers }).responseHeaders
  return headers?.getSetCookie() ?? []
}

/**
 * Keep `ctx`'s safe `callbackURL` beside the attempt this sign-in started, if
 * it started one. A failure is logged and swallowed: the reader still reaches
 * the code page, and the code form falls back to its own destination — losing
 * where she was headed is better than refusing a correct password.
 */
const keepDestination = async (ctx: AuthMiddlewareCtx): Promise<void> => {
  const destination = toSafeRedirectPath((ctx.body as { callbackURL?: unknown })?.callbackURL)
  if (destination === undefined) return
  const cookieName = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE).name
  const attemptId = attemptIdFromSetCookie(setCookiesOf(ctx), cookieName)
  if (attemptId === undefined) return
  try {
    const attempt = await ctx.context.internalAdapter.findVerificationValue(attemptId)
    if (!attempt) return
    await ctx.context.internalAdapter.createVerificationValue({
      identifier: destinationIdentifier(attemptId),
      value: destination,
      expiresAt: attempt.expiresAt,
    })
  } catch (err) {
    logError('[auth:two-factor] could not keep the sign-in destination beside its attempt', err)
  }
}

/**
 * The plugin keeping a sign-in's destination beside its pending attempt.
 * Registered right after Better Auth's two-factor plugin, so its `after` hook
 * runs once that plugin has stored the attempt and set its cookie (plugin hooks
 * run in plugin order, all of them after the app's own hooks).
 */
export const buildTwoFactorDestinationPlugin = () =>
  ({
    id: 'sovrium-two-factor-destination',
    hooks: {
      after: [
        {
          matcher: (ctx: { readonly path?: string }) => ctx.path === '/sign-in/email',
          handler: createAuthMiddleware(keepDestination),
        },
      ],
    },
  }) satisfies BetterAuthPlugin
