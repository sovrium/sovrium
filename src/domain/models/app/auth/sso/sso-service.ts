/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { SsoProvider, SsoRoleMapping } from './sso'

/**
 * The pure decisions behind single sign-on, shared by the server (which
 * provisions roles and refuses sign-ups) and the sign-in control (which routes
 * an email to its provider).
 */

/** The lowercase domain of an email address, or `undefined` when it has none. */
export const emailDomainOf = (email: string): string | undefined => {
  const at = email.lastIndexOf('@')
  if (at < 0 || at === email.length - 1) return undefined
  return email
    .slice(at + 1)
    .trim()
    .toLowerCase()
}

/** Whether `domain` is one of `owned`, or a subdomain of one. */
const domainIsOwned = (domain: string, owned: readonly string[]): boolean =>
  owned.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`))

/**
 * The provider that owns an email address's domain. A domain belongs to one
 * provider (validation refuses duplicates), so the first match is the only one.
 */
export const ssoProviderForEmail = <P extends { readonly domains?: readonly string[] }>(
  providers: readonly P[],
  email: string
): P | undefined => {
  const domain = emailDomainOf(email)
  if (domain === undefined) return undefined
  return providers.find((provider) => domainIsOwned(domain, provider.domains ?? []))
}

/**
 * The values a claim or attribute carries: a list stays a list, a single string
 * is one value, anything else carries none.
 */
export const claimValues = (value: unknown): readonly string[] => {
  if (typeof value === 'string') return value === '' ? [] : [value]
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === 'string')
  return []
}

/**
 * The role a mapping grants for the values a user carries.
 *
 * Entries are tried in the order written, and the first value the user carries
 * decides. Nothing matching falls back to the mapping's `default`, else to
 * `fallbackRole` (the app's `defaultRole`). A fallback is never allowed to be an
 * admin-tier role — validation already refuses such a `default`, and this guard
 * keeps the runtime from granting one even if the two drift: admin is reachable
 * only through an entry the author wrote.
 */
export const resolveSsoRole = (
  mapping: SsoRoleMapping,
  claim: unknown,
  fallbackRole: string,
  isAdminTierRole: (role: string) => boolean
): string => {
  const carried = new Set(claimValues(claim))
  const matched = Object.entries(mapping.map).find(([value]) => carried.has(value))
  if (matched !== undefined) return matched[1]
  const fallback = mapping.default ?? fallbackRole
  return isAdminTierRole(fallback) ? fallbackRole : fallback
}

/** Whether a first sign-in through `provider` may create an account. */
export const ssoSignUpAllowed = (
  provider: Pick<SsoProvider, 'allowSignUp'>,
  appAllowSignUp: boolean | undefined
): boolean => provider.allowSignUp ?? appAllowSignUp ?? true
