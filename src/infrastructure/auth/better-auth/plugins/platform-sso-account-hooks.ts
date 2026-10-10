/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError } from 'better-auth/api'
import { PLATFORM_SSO_PROVIDER_ID } from '@/domain/models/process-env/platform-sso'
import { isPlatformCallback } from './platform-sso'

/**
 * What "Sign in with Sovrium Cloud" may write, decided in Better Auth's
 * database hooks — the one point every path that writes an account or a user
 * passes through, whichever endpoint started it.
 */

/** The token columns an account row may carry; the platform's keep none of them. */
const TOKEN_FIELDS = [
  'accessToken',
  'refreshToken',
  'idToken',
  'accessTokenExpiresAt',
  'refreshTokenExpiresAt',
] as const

/** The row with every Cloud token cleared. */
const withoutTokens = (
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => ({
  ...row,
  ...Object.fromEntries(TOKEN_FIELDS.map((field) => [field, null])),
})

/** @public — named in the declarations of the auth instance. */
export interface PlatformAccountHookCtx {
  readonly path?: string
  readonly params?: unknown
  readonly context?: {
    readonly internalAdapter?: {
      readonly findAccounts: (
        userId: string
      ) => Promise<readonly { readonly providerId: string; readonly accountId: string }[]>
    }
  }
}

/**
 * `account.create.before`: an account binding a user to the Cloud keeps the
 * Cloud user id and no token, and a user binds one Cloud user at most — a
 * second, different one is refused (`false` aborts the write; Better Auth
 * answers the flow's error redirect).
 */
export const guardPlatformAccountCreate = async (
  account: Readonly<Record<string, unknown>>,
  ctx: PlatformAccountHookCtx | null
): Promise<false | { readonly data: Readonly<Record<string, unknown>> } | undefined> => {
  if (account['providerId'] !== PLATFORM_SSO_PROVIDER_ID) return undefined
  const adapter = ctx?.context?.internalAdapter
  const held = adapter === undefined ? [] : await adapter.findAccounts(String(account['userId']))
  const bound = held.some(
    (entry) =>
      entry.providerId === PLATFORM_SSO_PROVIDER_ID && entry.accountId !== account['accountId']
  )
  return bound ? false : { data: withoutTokens(account) }
}

/**
 * `account.update.before`: a sign-in through the Cloud refreshes the tokens on
 * the account it signs into; for the platform's account they are cleared
 * instead of written. Every update Better Auth makes to an OAuth account on
 * sign-in or link names its `providerId`.
 */
export const stripPlatformTokensOnUpdate = async (
  update: Readonly<Record<string, unknown>>
): Promise<{ readonly data: Readonly<Record<string, unknown>> } | undefined> =>
  update['providerId'] === PLATFORM_SSO_PROVIDER_ID ? { data: withoutTokens(update) } : undefined

/**
 * `user.create.before`: the Cloud's callback never creates a user. Sign-up is
 * already off on the provider; this is the second lock on the same door.
 */
export const refusePlatformSignUp = async (
  ctx: { readonly path?: string; readonly params?: unknown } | null
): Promise<void> => {
  if (isPlatformCallback(ctx)) {
    throw new APIError('FORBIDDEN', {
      code: 'signup_disabled',
      message: 'Sovrium Cloud does not create accounts',
    })
  }
}
