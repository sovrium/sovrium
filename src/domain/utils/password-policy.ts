/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Auth } from '@/domain/models/app/auth'

/**
 * Default minimum password length when no `emailAndPassword` strategy
 * override is supplied. Mirrors the Better Auth default and the limits
 * accepted by `EmailAndPasswordStrategySchema.minPasswordLength`.
 */
export const DEFAULT_PASSWORD_MIN_LENGTH = 8

/**
 * Default maximum password length when no `emailAndPassword` strategy
 * override is supplied. Mirrors the Better Auth default and the limits
 * accepted by `EmailAndPasswordStrategySchema.maxPasswordLength`.
 */
export const DEFAULT_PASSWORD_MAX_LENGTH = 128

/**
 * Resolved password policy applied to all sign-in / sign-up / accept-invitation
 * flows that gate on password length.
 */
export interface PasswordPolicy {
  readonly minLength: number
  readonly maxLength: number
}

/**
 * Resolve the password policy from an app's auth configuration.
 *
 * Returns the `minPasswordLength` / `maxPasswordLength` configured on the
 * `emailAndPassword` strategy when present, falling back to the documented
 * defaults (`8` / `128`) otherwise. Used as the single source of truth by:
 *
 *   - Better Auth `emailAndPassword` configuration (server-side enforcement)
 *   - The `acceptInvitation` use-case validator
 *   - The `accept-invitation` SSR page's inline client-side gate
 *
 * Safe to call with `undefined` — apps without an `auth` block fall back to
 * the defaults (matches current behaviour: defaults are 8/128).
 */
export const resolvePasswordPolicy = (authConfig?: Auth): PasswordPolicy => {
  const strategy = authConfig?.strategies?.find((s) => s.type === 'emailAndPassword')
  const minLength =
    strategy && 'minPasswordLength' in strategy && typeof strategy.minPasswordLength === 'number'
      ? strategy.minPasswordLength
      : DEFAULT_PASSWORD_MIN_LENGTH
  const maxLength =
    strategy && 'maxPasswordLength' in strategy && typeof strategy.maxPasswordLength === 'number'
      ? strategy.maxPasswordLength
      : DEFAULT_PASSWORD_MAX_LENGTH
  return { minLength, maxLength }
}
