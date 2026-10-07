/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError } from 'better-auth/api'
import { Effect } from 'effect'
// eslint-disable-next-line boundaries/dependencies -- the role an identity provider maps to can only be written from inside the SSO plugin's own `provisionUser` callback, which runs after Better Auth linked the account. Same bridge as the admin-role guards' restoring write.
import { updateUserRole } from '@/application/use-cases/tables/user-role'
import { isAdminTier } from '@/domain/models/app/auth/roles'
import { resolveSsoRole, ssoSignUpAllowed } from '@/domain/models/app/auth/sso/sso-service'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import { logError } from '@/infrastructure/logging/logger'
import type { Auth } from '@/domain/models/app/auth'
import type { SsoProvider } from '@/domain/models/app/auth/sso'

/**
 * What a single sign-on may do to accounts, decided inside Better Auth's own
 * lifecycle: whether a first sign-in may create one, what it may attach to an
 * existing one, and the role the provider maps to at every sign-in.
 */

/** The provider id an SSO callback or assertion-consumer request is for. */
const callbackProviderId = (
  ctx: { readonly path?: string; readonly params?: unknown } | null | undefined
): string | undefined => {
  const path = ctx?.path ?? ''
  if (!path.startsWith('/sso/callback/') && !path.startsWith('/sso/saml2/sp/acs/')) {
    return undefined
  }
  const providerId = (ctx?.params as { readonly providerId?: unknown } | undefined)?.providerId
  return typeof providerId === 'string' ? providerId : undefined
}

/**
 * Refuse the account a first SSO sign-in would create when that provider —
 * or, by default, the app — does not allow sign-up. Called from the
 * `user.create.before` database hook, the only point where "this sign-in is
 * about to create an account" is observable; Better Auth turns the error into
 * the provider's error redirect.
 */
export const refuseClosedSsoSignUp =
  (authConfig: Auth | undefined) =>
  async (
    user: Readonly<Record<string, unknown>>,
    ctx: { readonly path?: string; readonly params?: unknown } | null
  ): Promise<{ readonly data: Readonly<Record<string, unknown>> }> => {
    const providerId = callbackProviderId(ctx)
    const provider = (authConfig?.sso ?? []).find((candidate) => candidate.id === providerId)
    if (provider !== undefined && !ssoSignUpAllowed(provider, authConfig?.allowSignUp)) {
      throw new APIError('FORBIDDEN', {
        code: 'signup_disabled',
        message: 'This identity provider does not create accounts',
      })
    }
    return { data: user }
  }

/** Whether a verified ID token asserts `email_verified: true` (its payload was verified upstream). */
const idTokenAssertsVerifiedEmail = (idToken: unknown): boolean => {
  if (typeof idToken !== 'string') return false
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString()
    ) as {
      readonly email_verified?: unknown
    }
    return payload.email_verified === true || payload.email_verified === 'true'
  } catch {
    return false
  }
}

/** @public — named in the declarations of the auth instance. */
export interface AccountHookCtx {
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
 * The `account.create.before` database hook: what an SSO sign-in may attach
 * to an EXISTING account.
 *
 * - An account already linked to this provider stays bound to the subject it
 *   was first linked with: a later identity carrying the same email under a
 *   different subject is refused, never linked as a second identity.
 * - Linking an existing account over OIDC needs the provider to assert the
 *   address is verified (`email_verified: true` in the verified ID token). An
 *   unverified claim — a `upn` an employee or guest can influence — never
 *   takes over an account, even on a domain the provider owns.
 *
 * A first sign-in that creates its account passes untouched. `false` aborts
 * the write, and Better Auth answers the provider's error redirect.
 */
export const guardSsoAccountLink =
  (authConfig: Auth | undefined) =>
  async (
    account: Readonly<Record<string, unknown>>,
    ctx: AccountHookCtx | null
  ): Promise<false | undefined> => {
    const providerId = callbackProviderId(ctx)
    const provider = (authConfig?.sso ?? []).find((candidate) => candidate.id === providerId)
    const adapter = ctx?.context?.internalAdapter
    if (provider === undefined || account['providerId'] !== provider.id || adapter === undefined) {
      return undefined
    }
    return mayAttachSsoAccount(
      provider,
      account,
      await adapter.findAccounts(String(account['userId']))
    )
      ? undefined
      : false
  }

/** The decision behind {@link guardSsoAccountLink}, given the accounts the user already holds. */
const mayAttachSsoAccount = (
  provider: SsoProvider,
  account: Readonly<Record<string, unknown>>,
  held: readonly { readonly providerId: string; readonly accountId: string }[]
): boolean => {
  const others = held.filter(
    (entry) => !(entry.providerId === provider.id && entry.accountId === account['accountId'])
  )
  if (others.some((entry) => entry.providerId === provider.id)) return false
  if (others.length === 0) return true
  return provider.type !== 'oidc' || idTokenAssertsVerifiedEmail(account['idToken'])
}

/** @public — named in the declarations of the auth instance. */
export interface ProvisionInput {
  readonly user: { readonly id: string; readonly role?: unknown }
  readonly userInfo: Record<string, unknown>
  readonly provider: { readonly providerId: string }
}

/**
 * Apply the provider's role mapping. Runs at EVERY sign-in
 * (`provisionUserOnEveryLogin`), so the identity provider stays the source of
 * truth: removed from a mapped group there, a user is demoted here at their
 * next sign-in.
 */
export const provisionRole =
  (authConfig: Auth) =>
  async ({ user, userInfo, provider }: ProvisionInput): Promise<void> => {
    const declared = (authConfig.sso ?? []).find((entry) => entry.id === provider.providerId)
    const mapping = declared?.roleMapping
    if (mapping === undefined) return
    const role = resolveSsoRole(
      mapping,
      userInfo[mapping.claim],
      authConfig.defaultRole ?? 'member',
      (candidate) => isAdminTier(candidate, { auth: authConfig })
    )
    if (user.role === role) return
    await Effect.runPromise(
      updateUserRole(user.id, role).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[SSO] role mapping write failed', cause))
        ),
        Effect.provide(AuthRepositoryLive)
      )
    )
  }
