/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Auth } from './auth'

/**
 * Whether a stranger may create an account through the app's sign-in ways.
 *
 * Self-registration is closed unless the config opens it: only an explicit
 * `auth.allowSignUp: true` opens it. Omitted or `false`, accounts come from an
 * admin, an invitation, or the first-admin environment variables.
 */
export const isSignUpOpen = (authConfig: Pick<Auth, 'allowSignUp'> | undefined): boolean =>
  authConfig?.allowSignUp === true

/**
 * Resolve a door's own `allowSignUp` against the app's: the door's value wins
 * when set, then `auth.allowSignUp`, then closed.
 */
export const resolveSignUpAllowed = (
  doorAllowSignUp: boolean | undefined,
  appAllowSignUp: boolean | undefined
): boolean => doorAllowSignUp ?? appAllowSignUp ?? false

/**
 * Whether a magic link asked for an address with no account may create that
 * account: the magic-link strategy's own `allowSignUp`, then `auth.allowSignUp`,
 * then closed.
 */
export const isMagicLinkSignUpOpen = (authConfig: Auth | undefined): boolean => {
  // Read without the schema module's value exports: this file is pure, and
  // reaches the client bundle through the page capability check.
  const strategy = authConfig?.strategies?.find((entry) => entry.type === 'magicLink')
  return resolveSignUpAllowed(
    strategy?.type === 'magicLink' ? strategy.allowSignUp : undefined,
    authConfig?.allowSignUp
  )
}

/**
 * Whether the app declares a federated way in: an `oauth` strategy (social
 * providers) or at least one `auth.sso` identity provider. Such a provider
 * links an account by its email address, so an unconfirmed password account
 * holding someone else's address would later receive their federated sign-in.
 */
export const hasFederatedProvider = (
  authConfig: Pick<Auth, 'strategies' | 'sso'> | undefined
): boolean =>
  (authConfig?.strategies?.some((entry) => entry.type === 'oauth') ?? false) ||
  (authConfig?.sso ?? []).length > 0

/**
 * Whether a password account must confirm its address before it signs in: the
 * `emailAndPassword` strategy's own `requireEmailVerification` wins when
 * written; otherwise on beside a federated provider, off without one. Without
 * a password strategy there is no password account to hold, so it is off.
 */
export const resolveRequireEmailVerification = (
  authConfig: Pick<Auth, 'strategies' | 'sso'> | undefined
): boolean => {
  const strategy = authConfig?.strategies?.find((entry) => entry.type === 'emailAndPassword')
  if (strategy?.type !== 'emailAndPassword') return false
  return strategy.requireEmailVerification ?? hasFederatedProvider(authConfig)
}
