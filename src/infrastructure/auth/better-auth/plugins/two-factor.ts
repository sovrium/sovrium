/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { twoFactor } from 'better-auth/plugins'
import { appLabelOf } from '@/domain/models/app/pages/app-vars'
import { buildTwoFactorDestinationPlugin } from '../two-factor-destination'
import { buildTwoFactorLockoutPlugin, TWO_FACTOR_ACCOUNT_LOCKOUT } from '../two-factor-lockout'
import { buildPasswordlessTwoFactorPlugin } from '../two-factor-passwordless'
import type { TwoFactorLockoutNotifier } from '../two-factor-lockout-email-handler'
import type { Auth } from '@/domain/models/app/auth'

/** The configured issuer, else the app's display name; `undefined` with neither. */
const issuerOf = (
  configured: string | undefined,
  appName: string | undefined,
  displayName: string | undefined
) => configured ?? (appName === undefined ? undefined : appLabelOf({ name: appName, displayName }))

/**
 * Build two-factor plugin if enabled in auth configuration
 *
 * The issuer — the entry name an authenticator app shows — is the configured
 * `issuer`, else the app's display name (`$app.label`), never the library's
 * own "Better Auth".
 *
 * The account lockout is set here rather than left to the library's default,
 * so its numbers are Sovrium's: ten wrong codes in a row lock the second step
 * for fifteen minutes, the address is told (`notify`), and an administrator
 * can clear it (`two-factor-lockout.ts`).
 *
 * NOTE: modelName option removed - drizzleSchema in auth.ts uses standard model names
 * and Drizzle pgTable() definitions specify actual database table names
 */
export const buildTwoFactorPlugin = (
  authConfig: Auth | undefined,
  appName: string | undefined,
  appDisplayName: string | undefined,
  notify: TwoFactorLockoutNotifier
) => {
  if (!authConfig?.twoFactor) return []
  const config = typeof authConfig.twoFactor === 'boolean' ? {} : authConfig.twoFactor
  const issuer = issuerOf(config.issuer, appName, appDisplayName)
  const plugin = twoFactor({
    ...(issuer === undefined ? {} : { issuer }),
    totpOptions:
      config.digits !== undefined || config.period !== undefined
        ? {
            ...(config.digits !== undefined ? { digits: config.digits } : {}),
            ...(config.period !== undefined ? { period: config.period } : {}),
          }
        : undefined,
    backupCodeOptions: config.backupCodes ? {} : undefined,
    accountLockout: TWO_FACTOR_ACCOUNT_LOCKOUT,
  })
  return [
    plugin,
    // A sign-in link or code owes the second step like a password does.
    ...buildPasswordlessTwoFactorPlugin(plugin, authConfig),
    // After the plugins above, so its hooks see the attempt and the lock it stored.
    buildTwoFactorDestinationPlugin(),
    buildTwoFactorLockoutPlugin({ auth: authConfig }, notify),
  ]
}
