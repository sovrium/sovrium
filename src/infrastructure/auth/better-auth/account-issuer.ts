/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Account-issuer values.
 *
 * An `account` row is identified by `(issuer, accountId)` rather than by
 * `(providerId, accountId)`. Password accounts carry a single fixed issuer;
 * social accounts carry one derived from the provider id.
 *
 * These mirror `createLocalAccountIssuer` / `createOAuthAccountIssuer` in
 * `@better-auth/core`. Anything that writes an `account` row outside Better
 * Auth must set the column using these helpers — a row with a NULL issuer is
 * invisible to credential lookups, so its owner can neither sign in nor reset
 * their password, and nothing raises an error at insert time.
 */

/** Issuer for password ("credential") accounts. */
export const CREDENTIAL_ISSUER = 'local:credential'

/** Issuer for a password account. */
export const credentialIssuer = (): string => CREDENTIAL_ISSUER

/**
 * Issuer for a social account.
 *
 * `encodeURIComponent` matches upstream exactly. It is the identity function
 * for every provider id currently accepted (all lowercase ASCII), but it is
 * applied rather than assumed: if the provider set ever gains an id containing
 * a character that needs escaping, this stays correct while plain
 * concatenation would silently diverge from the value Better Auth writes.
 */
export const oauthIssuer = (providerId: string): string =>
  `local:oauth:${encodeURIComponent(providerId)}`
