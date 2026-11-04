/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError } from 'better-auth/api'
import {
  refusesIdentityOnOwnedDomain,
  ssoProviderForEmail,
} from '@/domain/models/app/auth/sso/sso-service'
import { CHANGE_EMAIL_PATH, SELF_SIGN_UP_PATHS, SIGN_UP_EMAIL_PATH } from './account-opening-routes'
import type { AuthMiddlewareCtx } from './hook-context'
import type { Auth } from '@/domain/models/app/auth'

/**
 * The body field each self-service door writes an address from. Admin account
 * creation and invitations are deliberately absent: an administrator choosing
 * to open an account is not someone claiming an address.
 */
const ADDRESS_FIELD_BY_PATH: Readonly<Record<string, 'email' | 'newEmail'>> = {
  [SIGN_UP_EMAIL_PATH]: 'email',
  [CHANGE_EMAIL_PATH]: 'newEmail',
}

/**
 * Refuse a password account on an email domain an identity provider owns.
 *
 * A domain listed in a provider's `domains` belongs to that provider: its
 * people sign in through it, and an account already on the domain is linked to
 * the provider's identity on first sign-in. A password account opened there
 * afterwards would be one the provider never vouched for, waiting to be linked
 * to the real person. So:
 *
 * - `/sign-up/email` with an address on an owned domain answers exactly what a
 *   closed sign-up answers — Better Auth's own `EMAIL_PASSWORD_SIGN_UP_DISABLED`
 *   400 — so the refusal says nothing a closed sign-up would not;
 * - `/change-email` to an address on an owned domain answers 400 and the
 *   address stays as it was.
 *
 * The comparison is case-insensitive and includes subdomains, as routing does
 * (`ssoProviderForEmail`).
 */
export function applySsoOwnedDomainGuard(ctx: AuthMiddlewareCtx, authConfig?: Auth): void {
  const field = ADDRESS_FIELD_BY_PATH[ctx.path]
  if (field === undefined) return
  const providers = authConfig?.sso ?? []
  if (providers.length === 0) return
  const address = (ctx.body as Readonly<Record<string, unknown>> | undefined)?.[field]
  if (typeof address !== 'string') return
  if (ssoProviderForEmail(providers, address) === undefined) return

  if (field === 'email') {
    throw APIError.from('BAD_REQUEST', {
      message: 'Email and password sign up is not enabled',
      code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED',
    })
  }
  throw APIError.from('BAD_REQUEST', {
    message: 'This address belongs to a domain that signs in through its identity provider',
    code: 'EMAIL_DOMAIN_OWNED_BY_IDENTITY_PROVIDER',
  })
}

// The doors that open an account on their own, other than a password sign-up
// (refused at the request, above), are `SELF_SIGN_UP_PATHS`. Each creates the
// account only once the address or the provider vouched for it, so the domain
// is judged where the row is about to be written rather than when the flow
// starts: an existing account on an owned domain keeps signing in by link,
// code or provider, which writes no new row.

/**
 * Refuse an account a sign-in link, a sign-in code or a social provider would
 * create on an email domain an identity provider owns, with the refusal
 * password sign-up answers there. On a provider's redirect, Better Auth
 * forwards that code to the error page (`?error=EMAIL_PASSWORD_SIGN_UP_DISABLED`).
 * Called from the `user.create.before` database hook: SSO sign-ins,
 * administrators opening accounts and seeds never reach it.
 */
export function refuseSsoOwnedDomainSelfSignUp(
  authConfig: Auth | undefined,
  user: Readonly<Record<string, unknown>>,
  ctx: { readonly path?: string } | null
): void {
  if (!SELF_SIGN_UP_PATHS.has(ctx?.path ?? '')) return
  const providers = authConfig?.sso ?? []
  if (providers.length === 0 || typeof user['email'] !== 'string') return
  if (ssoProviderForEmail(providers, user['email']) === undefined) return
  throw APIError.from('BAD_REQUEST', {
    message: 'Email and password sign up is not enabled',
    code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED',
  })
}

/** What Better Auth's `user.validateUserInfo` gate is handed, as far as this rule reads it. */
export interface ValidatedIdentity {
  readonly user: { readonly email?: unknown }
  readonly source: {
    readonly action: string
    readonly method: string
    readonly oauth?: { readonly providerId: string } | undefined
  }
}

/**
 * The `user.validateUserInfo` gate: a social or OAuth sign-in identity (Google,
 * GitHub, a generic OAuth provider) is never added to an account whose address
 * is on a domain an identity provider owns. Better Auth asks this gate before
 * it adds an identity on both roads — returning from a provider with an
 * existing account's address, and a signed-in person asking to add one
 * (`/link-social`) — and forwards the code to the error page
 * (`?error=EMAIL_DOMAIN_OWNED_BY_IDENTITY_PROVIDER`) with no session.
 *
 * An identity the account already holds signs in without reaching this
 * question, an identity provider's own identity is the road the domain takes,
 * and a new account on the domain is refused at creation
 * ({@link refuseSsoOwnedDomainSelfSignUp}); a domain no provider owns is never
 * judged.
 */
export const refuseSocialIdentityOnSsoOwnedDomain =
  (authConfig: Auth | undefined) =>
  ({ user, source }: ValidatedIdentity) => {
    const providers = authConfig?.sso ?? []
    if (source.action !== 'link-account' || source.method !== 'oauth') return undefined
    const providerId = source.oauth?.providerId
    if (providerId === undefined || typeof user.email !== 'string') return undefined
    if (!refusesIdentityOnOwnedDomain(providers, { providerId, email: user.email })) {
      return undefined
    }
    return {
      error: 'EMAIL_DOMAIN_OWNED_BY_IDENTITY_PROVIDER',
      errorDescription:
        'This address belongs to a domain that signs in through its identity provider',
    }
  }
