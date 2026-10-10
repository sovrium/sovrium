/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { twoFactor } from 'better-auth/plugins'
import { titleCaseAppName } from '@/domain/models/app/pages/app-vars'
import { buildTwoFactorDestinationPlugin } from '../two-factor-destination'
import type { Auth } from '@/domain/models/app/auth'

/** The configured issuer, else the app's display name; `undefined` with neither. */
const issuerOf = (configured: string | undefined, appName: string | undefined) =>
  configured ?? (appName === undefined ? undefined : titleCaseAppName(appName))

/**
 * Build two-factor plugin if enabled in auth configuration
 *
 * The issuer — the entry name an authenticator app shows — is the configured
 * `issuer`, else the app's display name (`$app.label`), never the library's
 * own "Better Auth".
 *
 * NOTE: modelName option removed - drizzleSchema in auth.ts uses standard model names
 * and Drizzle pgTable() definitions specify actual database table names
 */
export const buildTwoFactorPlugin = (authConfig?: Auth, appName?: string) => {
  if (!authConfig?.twoFactor) return []
  const config = typeof authConfig.twoFactor === 'boolean' ? {} : authConfig.twoFactor
  const issuer = issuerOf(config.issuer, appName)
  return [
    twoFactor({
      ...(issuer === undefined ? {} : { issuer }),
      totpOptions:
        config.digits !== undefined || config.period !== undefined
          ? {
              ...(config.digits !== undefined ? { digits: config.digits } : {}),
              ...(config.period !== undefined ? { period: config.period } : {}),
            }
          : undefined,
      backupCodeOptions: config.backupCodes ? {} : undefined,
    }),
    // After the plugin above, so its hook sees the attempt that plugin stored.
    buildTwoFactorDestinationPlugin(),
  ]
}
