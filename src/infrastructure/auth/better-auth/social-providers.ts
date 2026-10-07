/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getStrategy } from '@/domain/models/app/auth'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Build socialProviders configuration from auth config
 *
 * Credentials are loaded from environment variables using the pattern:
 * - {PROVIDER}_CLIENT_ID (e.g., GOOGLE_CLIENT_ID)
 * - {PROVIDER}_CLIENT_SECRET (e.g., GOOGLE_CLIENT_SECRET)
 * `allowSignUp: false` closes each provider to identities without an account.
 */
export const buildSocialProviders = (authConfig?: Auth) => {
  const oauthStrategy = getStrategy(authConfig, 'oauth')
  if (!oauthStrategy?.providers) return {}

  return oauthStrategy.providers.reduce(
    (providers, provider) => {
      const envVarPrefix = provider.toUpperCase()
      return {
        ...providers,
        [provider]: {
          clientId: process.env[`${envVarPrefix}_CLIENT_ID`] || '',
          clientSecret: process.env[`${envVarPrefix}_CLIENT_SECRET`] || '',
          disableSignUp: authConfig?.allowSignUp === false, // every door, not just the form
        },
      }
    },
    {} as Record<string, { clientId: string; clientSecret: string; disableSignUp: boolean }>
  )
}
