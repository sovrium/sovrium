/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { twoFactor } from 'better-auth/plugins'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Build two-factor plugin if enabled in auth configuration
 *
 * NOTE: modelName option removed - drizzleSchema in auth.ts uses standard model names
 * and Drizzle pgTable() definitions specify actual database table names
 */
export const buildTwoFactorPlugin = (authConfig?: Auth) => {
  if (!authConfig?.twoFactor) return []
  const config = typeof authConfig.twoFactor === 'boolean' ? {} : authConfig.twoFactor
  return [
    twoFactor({
      issuer: config.issuer,
      totpOptions:
        config.digits !== undefined || config.period !== undefined
          ? {
              ...(config.digits !== undefined ? { digits: config.digits as 6 | 8 } : {}),
              ...(config.period !== undefined ? { period: config.period } : {}),
            }
          : undefined,
      backupCodeOptions: config.backupCodes ? {} : undefined,
    }),
  ]
}
